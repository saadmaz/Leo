"""
Blog Content Brief Generator.

Takes a confirmed target keyword + brand core + content library state,
runs SERP analysis, checks for cannibalization, then generates a
structured content brief via Claude.

The brief is stored in Firestore `blog_briefs` collection.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from backend.config import settings
from backend.services.llm_service import get_client, build_brand_core_context

logger = logging.getLogger(__name__)

_BRIEF_COLLECTION = "blog_briefs"


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Cannibalization check
# ---------------------------------------------------------------------------

def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    matrix = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        matrix[i][0] = i
    for j in range(len(b) + 1):
        matrix[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            )
    return matrix[len(a)][len(b)]


def _check_cannibalization(project_id: str, keyword: str) -> Optional[str]:
    """
    Check the content library for existing blog posts that target the same keyword.
    Returns a warning string if a match is found, None if clear.
    """
    try:
        from backend.services import firebase_service
        items = firebase_service.list_content_library_items(
            project_id, item_type="Blog Post", limit=200
        )
        normalized = re.sub(r"\s+", " ", keyword.lower().strip())
        for item in items:
            existing_kw = item.get("target_keyword") or item.get("metadata", {}).get("target_keyword", "")
            if not existing_kw:
                # Fall back to checking topic/title
                existing_kw = item.get("topic") or item.get("title") or ""
            existing_norm = re.sub(r"\s+", " ", str(existing_kw).lower().strip())
            if not existing_norm:
                continue
            # Exact match
            if normalized == existing_norm:
                return f'Existing post targets the same keyword: "{existing_kw}"'
            # Fuzzy match (Levenshtein distance ≤ 3)
            if _levenshtein(normalized, existing_norm) <= 3:
                return f'Existing post may overlap: "{existing_kw}" — verify before proceeding'
    except Exception as exc:
        logger.warning("Cannibalization check failed: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Firestore brief CRUD
# ---------------------------------------------------------------------------

def save_brief(project_id: str, brief: dict) -> dict:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        now = datetime.now(timezone.utc).isoformat()
        data = {**brief, "project_id": project_id, "created_at": now, "updated_at": now}
        ref = db.collection(_BRIEF_COLLECTION).document()
        ref.set(data)
        return {"id": ref.id, **data}
    except Exception as exc:
        logger.error("Failed to save brief: %s", exc)
        return {"id": "unsaved", **brief}


def list_briefs(project_id: str, limit: int = 50) -> list[dict]:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        docs = (
            db.collection(_BRIEF_COLLECTION)
            .where("project_id", "==", project_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [{"id": d.id, **d.to_dict()} for d in docs]
    except Exception as exc:
        logger.error("Failed to list briefs: %s", exc)
        return []


def get_brief(brief_id: str) -> Optional[dict]:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        doc = db.collection(_BRIEF_COLLECTION).document(brief_id).get()
        if not doc.exists:
            return None
        return {"id": doc.id, **doc.to_dict()}
    except Exception as exc:
        logger.error("Failed to get brief: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Main stream
# ---------------------------------------------------------------------------

async def stream_brief_generation(
    project_id: str,
    project_name: str,
    brand_core: dict,
    keyword: str,
    serp_analysis: dict,
    location_code: int = 2840,
) -> AsyncGenerator[str, None]:
    """
    Generate a structured blog content brief grounded in SERP analysis.

    SSE events:
      { type: "step",        label, status }
      { type: "cannibalization_warning", warning }
      { type: "done",        brief }
      { type: "error",       error }
    """
    # Step 1: Cannibalization check
    yield _sse({"type": "step", "label": "Checking for topic cannibalization", "status": "running"})
    warning = _check_cannibalization(project_id, keyword)
    if warning:
        yield _sse({"type": "cannibalization_warning", "warning": warning})
    yield _sse({"type": "step", "label": "Cannibalization check complete", "status": "done"})

    # Step 2: Generate brief via Claude
    yield _sse({"type": "step", "label": "Generating content brief from SERP data", "status": "running"})

    brand_context = build_brand_core_context(brand_core)
    consensus_h2s = serp_analysis.get("consensus_h2s", [])
    nlp_terms = serp_analysis.get("nlp_terms_required", [])
    recommended_wc = serp_analysis.get("recommended_word_count", 1200)
    content_gap = serp_analysis.get("content_gap", "")
    competing_urls = serp_analysis.get("competing_urls", [])

    prompt = f"""You are a senior SEO content strategist creating a detailed blog brief for {project_name}.

BRAND VOICE:
{brand_context}

TARGET KEYWORD: {keyword}
RECOMMENDED WORD COUNT: {recommended_wc}

SERP ANALYSIS:
- Consensus H2 structure (appear in top results): {json.dumps(consensus_h2s)}
- Required NLP terms (present in 7+ top pages): {json.dumps(nlp_terms)}
- Content gap identified: {content_gap}
- Top competing pages:
{json.dumps(competing_urls, indent=2)}

Generate a complete content brief. Return ONLY valid JSON:
{{
  "target_keyword": "{keyword}",
  "title_options": ["<SEO title variant 1>", "<SEO title variant 2>", "<SEO title variant 3>"],
  "recommended_word_count": {recommended_wc},
  "h2_structure": [
    {{
      "heading": "<H2 text>",
      "purpose": "<one-sentence note on what this section must cover>",
      "word_target": <target word count for this section>
    }}
  ],
  "nlp_terms_required": {json.dumps(nlp_terms[:20])},
  "content_angle": "<the specific angle this post should take to beat the gap>",
  "brand_angle": "<how {project_name}'s brand voice and positioning shapes this angle>",
  "intro_hook": "<suggested first sentence or opening approach>",
  "cta_suggestion": "<what the post should drive the reader to do>",
  "competing_urls": {json.dumps(competing_urls)},
  "cannibalization_warning": {json.dumps(warning)}
}}

Rules:
- h2_structure: 4-7 sections that cover the consensus topics PLUS the content gap. Total word_targets should sum to ~{recommended_wc}.
- title_options: Each must include the target keyword, be 50-60 chars, and use a different angle.
- content_angle: Must be specific. Not "be more thorough" — name the angle (e.g. "first-time founder perspective" or "quantified ROI data").
- brand_angle: Must reference actual brand voice elements from the brand context above.
"""

    client = get_client()
    raw_parts: list[str] = []
    try:
        async with client.messages.stream(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                raw_parts.append(text)
    except Exception as exc:
        yield _sse({"type": "error", "error": f"Brief generation failed: {exc}"})
        return

    raw = "".join(raw_parts).strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        brief_data = json.loads(raw)
    except json.JSONDecodeError:
        yield _sse({"type": "error", "error": "Failed to parse brief JSON from Claude output"})
        return

    yield _sse({"type": "step", "label": "Brief generated — saving", "status": "done"})

    saved = save_brief(project_id, brief_data)
    yield _sse({"type": "done", "brief": saved})
    yield "data: [DONE]\n\n"
