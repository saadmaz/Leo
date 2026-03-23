"""
Reports routes — Phase 10.

Endpoints:
  GET  /projects/{id}/reports/digest        — AI-generated weekly digest
  POST /projects/{id}/reports/score-content — Batch brand voice score for library items
"""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.api.deps import get_project_as_member
from backend.middleware.auth import CurrentUser
from backend.services import analytics_service, intelligence_service, firebase_service
from backend.config import settings
from backend.services.llm_service import get_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["reports"])


# ---------------------------------------------------------------------------
# Weekly digest
# ---------------------------------------------------------------------------

@router.get("/reports/digest")
async def get_weekly_digest(project_id: str, user: CurrentUser):
    """Generate an AI-powered weekly digest with trends and recommendations."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    overview = await analytics_service.get_overview(project_id)
    trends = await analytics_service.get_trends(project_id)
    activity = await analytics_service.get_activity_feed(project_id, limit=30)

    # Recent activity summary
    recent_types: dict[str, int] = {}
    for evt in activity:
        t = evt.get("event_type", "other")
        recent_types[t] = recent_types.get(t, 0) + 1

    brand_name = brand_core.get("messaging", {}).get("valueProp", "") or project.get("name", "your brand")
    tone = brand_core.get("tone", {}).get("style", "professional")

    prompt = f"""You are a senior marketing strategist reviewing weekly performance for {brand_name}.

CONTENT STATS:
- Total content items: {overview['total_content']}
- Posted this period: {overview['total_posted']}
- Average engagement: {overview['avg_engagement']} (tracked posts)
- Total impressions tracked: {overview['total_impressions']}
- Best performing platform: {overview['best_platform'] or 'not yet determined'}
- Platform distribution: {overview['platform_breakdown']}

CONTENT MIX:
- Status breakdown: {trends['status_breakdown']}
- Platform breakdown: {trends['platform_breakdown']}

RECENT ACTIVITY EVENTS: {recent_types}

Generate a professional weekly digest report with these exact sections (use markdown headers):

## Performance Summary
2-3 sentences highlighting the key wins and metrics.

## What Worked
2-3 bullet points of what's performing well.

## Opportunities
2-3 bullet points identifying gaps or underperforming areas.

## This Week's Recommendations
4-5 specific, actionable content recommendations. Be concrete (e.g. "Post 2 LinkedIn articles this week focused on X" not "post more content").

## Content Health Score
Give an overall content health score out of 10 with a one-line justification.

Keep the tone {tone} and focused on actionable insights. Be direct — no filler text."""

    client = get_client()
    response = await client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    digest_text = response.content[0].text

    return {
        "digest": digest_text,
        "overview": overview,
        "trends": trends,
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Batch content scoring
# ---------------------------------------------------------------------------

class ScoreRequest(BaseModel):
    item_ids: list[str]


@router.post("/reports/score-content")
async def score_content_batch(
    project_id: str,
    body: ScoreRequest,
    user: CurrentUser,
):
    """Score a batch of content library items against brand voice. Returns scores keyed by item_id."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore")

    if not brand_core:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand Core not set up yet.",
        )

    results: dict[str, dict] = {}
    for item_id in body.item_ids[:20]:  # cap at 20 to avoid timeout
        try:
            item_doc = (
                firebase_service.db
                .collection("projects").document(project_id)
                .collection("content_library").document(item_id)
                .get()
            )
            if not item_doc.exists:
                continue
            content = item_doc.to_dict().get("content", "")
            if not content:
                continue
            score_result = await intelligence_service.score_brand_voice(content, brand_core)
            score = score_result.get("score", 0)
            # Persist score on content item
            firebase_service.db \
                .collection("projects").document(project_id) \
                .collection("content_library").document(item_id) \
                .update({"voice_score": score})
            results[item_id] = {"score": score, "feedback": score_result.get("feedback", "")}
        except Exception as exc:
            logger.warning("Score failed for item %s: %s", item_id, exc)
            results[item_id] = {"score": None, "error": str(exc)}

    return results
