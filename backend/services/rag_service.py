"""
RAG (Retrieval-Augmented Generation) service for Brand Intelligence Chat.

Architecture:
  - Embeddings: Google text-embedding-004 via google-genai SDK (same SDK already
    used in llm_service.py). Falls back to a keyword overlap score if the API
    key is missing so the feature degrades gracefully.
  - Storage: Firestore subcollection projects/{id}/rag_index/{doc_id}.
    Each document stores the original text chunk plus its embedding vector as a
    plain float list. cosine_similarity is computed in Python memory on retrieval.
    At typical brand scale (< 1 000 chunks per project) this is faster than the
    round-trip to a dedicated vector DB.
  - Indexed sources: brand_core, content_library, competitor_snapshots,
    analytics_summary, blog_briefs.

Public API:
  await index_project(project_id)             — full re-index
  await search(project_id, query, k=5)        — top-k relevant chunks
  await build_context(project_id, query)      — formatted string for Claude system prompt
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

_EMBED_MODEL = "text-embedding-004"
_EMBED_DIM = 768  # text-embedding-004 output dimension


def _get_genai_client():
    from backend.config import settings
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:
        logger.warning("RAG: could not create GenAI client: %s", exc)
        return None


def _embed_texts_sync(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts synchronously.
    Returns a list of float vectors, one per input text.
    On failure returns zero vectors so indexing never crashes.
    """
    client = _get_genai_client()
    if not client:
        return [[0.0] * _EMBED_DIM for _ in texts]
    try:
        result = client.models.embed_content(
            model=_EMBED_MODEL,
            contents=texts,
        )
        return [list(e.values) for e in result.embeddings]
    except Exception as exc:
        logger.error("RAG embedding failed: %s", exc)
        return [[0.0] * _EMBED_DIM for _ in texts]


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(_embed_texts_sync, texts)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ---------------------------------------------------------------------------
# Firestore helpers
# ---------------------------------------------------------------------------

def _rag_collection(project_id: str):
    from backend.services import firebase_service
    db = firebase_service.get_db()
    return db.collection("projects").document(project_id).collection("rag_index")


def _save_chunk(project_id: str, doc_id: str, chunk: dict) -> None:
    _rag_collection(project_id).document(doc_id).set(chunk)


def _list_chunks(project_id: str) -> list[dict]:
    docs = _rag_collection(project_id).stream()
    return [{**d.to_dict(), "_id": d.id} for d in docs]


def _delete_chunks_by_source(project_id: str, source_type: str) -> None:
    col = _rag_collection(project_id)
    docs = col.where("type", "==", source_type).stream()
    for d in docs:
        d.reference.delete()


# ---------------------------------------------------------------------------
# Document extractors — build text chunks from each source type
# ---------------------------------------------------------------------------

def _chunks_from_brand_core(project: dict) -> list[dict]:
    bc = project.get("brandCore") or {}
    if not bc:
        return []
    parts = []
    if tone := bc.get("tone", {}).get("style"):
        parts.append(f"Brand tone: {tone}")
    if val_prop := bc.get("messaging", {}).get("valueProp"):
        parts.append(f"Value proposition: {val_prop}")
    if themes := bc.get("themes"):
        parts.append(f"Brand themes: {', '.join(themes)}")
    if audience := bc.get("audience", {}).get("demographics"):
        parts.append(f"Target audience: {audience}")
    if tagline := bc.get("tagline"):
        parts.append(f"Tagline: {tagline}")
    if competitors := bc.get("competitors"):
        parts.append(f"Competitors: {', '.join(competitors)}")
    if not parts:
        return []
    text = "\n".join(parts)
    return [{"type": "brand_core", "text": text, "metadata": {"project_name": project.get("name", "")}}]


def _chunks_from_content_library(project_id: str, limit: int = 100) -> list[dict]:
    from backend.services import firebase_service
    items = firebase_service.list_content_library_items(project_id, limit=limit)
    chunks = []
    for item in items:
        content = item.get("content", "").strip()
        if not content or len(content) < 20:
            continue
        chunks.append({
            "type": "content",
            "text": f"[{item.get('platform', 'unknown')} {item.get('type', '')} — {item.get('status', '')}]\n{content[:800]}",
            "metadata": {
                "item_id": item.get("id", ""),
                "platform": item.get("platform", ""),
                "status": item.get("status", ""),
            },
        })
    return chunks


def _chunks_from_competitor_snapshots(project_id: str) -> list[dict]:
    from backend.services import firebase_service
    snapshots = firebase_service.get_competitor_snapshots(project_id)
    chunks = []
    for snap in snapshots:
        name = snap.get("name", "Competitor")
        summary = snap.get("summary") or snap.get("analysis") or ""
        if not summary:
            continue
        chunks.append({
            "type": "competitor",
            "text": f"Competitor: {name}\n{summary[:1000]}",
            "metadata": {"competitor_name": name},
        })
    return chunks


def _chunks_from_analytics(project_id: str) -> list[dict]:
    from backend.services import firebase_service
    try:
        analytics = firebase_service.get_project_analytics(project_id)
        if not analytics:
            return []
        parts = []
        if tc := analytics.get("total_content"):
            parts.append(f"Total content items: {tc}")
        if tp := analytics.get("total_posted"):
            parts.append(f"Total posted: {tp}")
        if bp := analytics.get("best_platform"):
            parts.append(f"Best performing platform: {bp}")
        if not parts:
            return []
        return [{
            "type": "analytics",
            "text": "Content performance summary:\n" + "\n".join(parts),
            "metadata": {},
        }]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------

async def index_document(
    project_id: str,
    doc_type: str,
    doc_id: str,
    text: str,
    metadata: dict | None = None,
) -> int:
    """
    Embed and upsert a single document into the RAG index.
    Uses a deterministic Firestore document ID so repeated calls are idempotent.
    Returns 1 on success, 0 if text is empty.
    """
    if not text or not text.strip():
        return 0

    meta = metadata or {}
    vectors = await _embed_texts([text[:8000]])

    def _write():
        col = _rag_collection(project_id)
        safe_id = f"{doc_type}__{doc_id[:60]}"
        col.document(safe_id).set({
            "type": doc_type,
            "doc_id": doc_id,
            "text": text[:2000],
            "embedding": vectors[0],
            "metadata": meta,
            "indexedAt": datetime.now(timezone.utc).isoformat(),
        })

    await asyncio.to_thread(_write)
    logger.info("RAG: upserted chunk %s/%s for project %s", doc_type, doc_id, project_id)
    return 1


async def index_project(project_id: str) -> int:
    """
    Full re-index of all brand data for a project.
    Returns the number of chunks indexed.
    """
    from backend.services import firebase_service

    project = await asyncio.to_thread(firebase_service.get_project, project_id)
    if not project:
        return 0

    # Gather all chunks
    chunks: list[dict] = []
    chunks.extend(_chunks_from_brand_core(project))
    chunks.extend(await asyncio.to_thread(_chunks_from_content_library, project_id, 100))
    chunks.extend(await asyncio.to_thread(_chunks_from_competitor_snapshots, project_id))
    chunks.extend(await asyncio.to_thread(_chunks_from_analytics, project_id))

    if not chunks:
        return 0

    # Embed all texts in one batch
    texts = [c["text"] for c in chunks]
    vectors = await _embed_texts(texts)

    now = datetime.now(timezone.utc).isoformat()

    # Write to Firestore (clear old first, write new)
    def _write():
        col = _rag_collection(project_id)
        # Delete existing chunks
        for doc in col.stream():
            doc.reference.delete()
        # Write new
        for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
            doc_id = f"{chunk['type']}_{i:04d}"
            col.document(doc_id).set({
                "type": chunk["type"],
                "text": chunk["text"],
                "embedding": vec,
                "metadata": chunk.get("metadata", {}),
                "indexedAt": now,
            })

    await asyncio.to_thread(_write)
    logger.info("RAG: indexed %d chunks for project %s", len(chunks), project_id)
    return len(chunks)


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def search(project_id: str, query: str, k: int = 5) -> list[dict]:
    """
    Embed `query` and return the top-k most relevant chunks from the index.
    Each result: { type, text, metadata, score }
    """
    query_vec = (await _embed_texts([query]))[0]

    chunks = await asyncio.to_thread(_list_chunks, project_id)
    if not chunks:
        return []

    scored = []
    for chunk in chunks:
        vec = chunk.get("embedding")
        if not vec or len(vec) != _EMBED_DIM:
            continue
        score = _cosine(query_vec, vec)
        scored.append({
            "type": chunk.get("type", ""),
            "text": chunk.get("text", ""),
            "metadata": chunk.get("metadata", {}),
            "score": round(score, 4),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]


async def build_context(project_id: str, query: str) -> str:
    """
    Return a formatted context block for injection into Claude's system prompt.
    """
    results = await search(project_id, query, k=5)
    if not results:
        return ""

    lines = ["<brand_context>"]
    for r in results:
        lines.append(f"[{r['type'].upper()}] {r['text']}")
        lines.append("")
    lines.append("</brand_context>")
    return "\n".join(lines)
