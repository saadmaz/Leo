"""
Brand Intelligence Chat routes — RAG-powered Q&A about the user's brand.

Endpoints:
  POST /projects/{id}/brand-chat/message    — SSE: RAG retrieval + Claude answer
  POST /projects/{id}/brand-chat/index      — Trigger full re-index of brand data
  GET  /projects/{id}/brand-chat/history    — Last N brand-chat messages

SSE event format:
  data: {"type": "sources", "sources": [...]}
  data: {"type": "delta", "text": "..."}
  data: [DONE]
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_member, require_tier
from backend.middleware.auth import CurrentUser
from backend.middleware.rate_limit import limiter
from backend.services import firebase_service, rag_service
from backend.services.llm_service import get_client
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/brand-chat", tags=["brand-chat"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BrandChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


# ---------------------------------------------------------------------------
# Firestore helpers
# ---------------------------------------------------------------------------

def _save_brand_chat_message(project_id: str, role: str, content: str, sources: Optional[list] = None) -> str:
    from datetime import datetime, timezone
    db = firebase_service.get_db()
    ref = (
        db.collection("projects").document(project_id)
        .collection("brand_chat").document()
    )
    doc = {
        "role": role,
        "content": content,
        "sources": sources or [],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    ref.set(doc)
    return ref.id


def _list_brand_chat_messages(project_id: str, limit: int = 40) -> list[dict]:
    db = firebase_service.get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("brand_chat")
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    msgs = [{"id": d.id, **d.to_dict()} for d in docs]
    msgs.reverse()
    return msgs


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/index")
async def index_brand_data(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Trigger a full re-index of the project's brand data for RAG retrieval."""
    get_project_as_member(project_id, user["uid"])
    indexed = await rag_service.index_project(project_id)
    return {"ok": True, "indexed": indexed}


@router.get("/history")
async def get_history(
    project_id: str,
    user: CurrentUser,
    limit: int = Query(40, ge=1, le=100),
    _tier: None = require_tier("pro"),
):
    """Return recent brand-chat messages for the project."""
    get_project_as_member(project_id, user["uid"])
    messages = await asyncio.to_thread(_list_brand_chat_messages, project_id, limit)
    return {"messages": messages}


@router.post("/message")
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    project_id: str,
    body: BrandChatMessageRequest,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """
    RAG-powered brand Q&A. Retrieves relevant brand context chunks, then
    streams a Claude answer grounded in that context as SSE deltas.

    SSE events:
      {"type": "sources", "sources": [...]}   — retrieved context chunks
      {"type": "delta", "text": "..."}        — streamed answer text
      data: [DONE]
    """
    project = get_project_as_member(project_id, user["uid"])

    # Persist the user message
    await asyncio.to_thread(
        _save_brand_chat_message, project_id, "user", body.message,
    )

    async def event_stream():
        # 1 — Retrieve relevant chunks
        try:
            sources = await rag_service.search(project_id, body.message, k=5)
        except Exception as exc:
            logger.error("RAG search failed for project %s: %s", project_id, exc)
            sources = []

        # Emit sources event so the frontend can show citations
        yield f"data: {json.dumps({'type': 'sources', 'sources': [{'id': str(i), 'type': s['type'], 'text': s['text'][:200], 'metadata': s.get('metadata', {})} for i, s in enumerate(sources)]})}\n\n"

        # 2 — Build system prompt with brand context
        brand_name = project.get("name", "this brand")
        context_block = "\n\n".join(s["text"] for s in sources) if sources else ""

        system_prompt = f"""You are Brand Intelligence — an AI assistant that knows {brand_name}'s content strategy, brand voice, competitors, and performance data intimately.

Answer the user's question using the brand context below. Be specific and data-driven when the context supports it. If the context doesn't cover the question, say so and answer from general marketing knowledge.

{('<brand_context>\n' + context_block + '\n</brand_context>') if context_block else ''}

Rules:
- Be concise and actionable.
- Reference specific data from the brand context when available.
- Do not invent metrics or competitor details not in the context."""

        # 3 — Stream Claude answer
        client = get_client()
        full_response = []
        try:
            async with client.messages.stream(
                model=settings.LLM_CHAT_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": body.message}],
            ) as stream:
                async for text in stream.text_stream:
                    full_response.append(text)
                    yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"
        except Exception as exc:
            logger.error("Brand chat stream failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to generate response'})}\n\n"
            return

        yield "data: [DONE]\n\n"

        # 4 — Persist assistant message (fire-and-forget)
        response_text = "".join(full_response)
        source_refs = [
            {"id": str(i), "type": s["type"], "text": s["text"][:200], "metadata": s.get("metadata", {})}
            for i, s in enumerate(sources)
        ]
        asyncio.create_task(
            asyncio.to_thread(_save_brand_chat_message, project_id, "assistant", response_text, source_refs)
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
