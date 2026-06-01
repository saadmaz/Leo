"""
Analytics routes - Phase 7.

Endpoints:
  POST /projects/{id}/analytics/{item_id}/metrics  - Log performance metrics
  GET  /projects/{id}/analytics/overview           - Aggregate stats
  GET  /projects/{id}/analytics/content            - Per-content performance table
  GET  /projects/{id}/analytics/trends             - Time-series trend data
  GET  /projects/{id}/analytics/activity           - Activity feed
  GET  /projects/{id}/analytics/ai-summary         - AI performance analysis
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.api.deps import get_project_as_member, require_tier
from backend.middleware.auth import CurrentUser
from backend.services import analytics_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["analytics"])


class MetricsPayload(BaseModel):
    platform: str = ""
    impressions: int = 0
    reach: int = 0
    clicks: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0


@router.post("/analytics/{item_id}/metrics")
async def log_metrics(
    project_id: str,
    item_id: str,
    payload: MetricsPayload,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return await analytics_service.log_metrics(project_id, item_id, payload.model_dump())


@router.get("/analytics/overview")
async def get_overview(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return await analytics_service.get_overview(project_id)


@router.get("/analytics/content")
async def get_content_performance(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return await analytics_service.get_content_performance(project_id)


@router.get("/analytics/trends")
async def get_trends(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return await analytics_service.get_trends(project_id)


@router.get("/analytics/activity")
async def get_activity(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return await analytics_service.get_activity_feed(project_id)


@router.get("/analytics/ai-summary")
async def get_ai_summary(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    get_project_as_member(project_id, user["uid"])
    summary = await analytics_service.generate_performance_summary(project_id)
    return {"summary": summary}


@router.get("/analytics/compare")
async def get_comparison(
    project_id: str,
    user: CurrentUser,
    period: Optional[str] = Query("7d", regex="^(7d|30d)$"),
    _tier: None = require_tier("pro"),
):
    """Compare key metrics for the current period vs the previous same-length period."""
    get_project_as_member(project_id, user["uid"])
    days = 30 if period == "30d" else 7
    return await analytics_service.get_comparison(project_id, days)


@router.get("/analytics/context-summary")
async def get_context_summary(
    project_id: str,
    user: CurrentUser,
):
    """
    Lightweight cross-pillar context snapshot for the ContextPanel component.

    Aggregates in a single request:
      - recent brand monitoring alerts (last 3, 14 days)
      - brand voice trend from recent library items
      - competitor count
      - active campaign (most recent ready campaign)
      - top performing content type

    All sub-queries are best-effort — partial results are returned on any failure.
    Response is intentionally fast (<200ms target) by using Firestore directly.
    """
    get_project_as_member(project_id, user["uid"])
    import asyncio
    from backend.services import firebase_service

    async def _alerts():
        try:
            alerts = await asyncio.to_thread(
                firebase_service.list_monitor_alerts,
                project_id, False, 3, 14
            )
            return [
                {
                    "title": a.get("title", ""),
                    "sentiment": a.get("sentiment", "neutral"),
                    "subject": a.get("subject"),
                    "timestamp": a.get("publishedAt") or a.get("savedAt", ""),
                }
                for a in alerts[:3]
            ]
        except Exception:
            return []

    async def _voice_trend():
        try:
            items = await asyncio.to_thread(
                firebase_service.list_content_library_items,
                project_id, None, None, None, 10
            )
            scored = [i for i in items if i.get("voice_score") is not None]
            if len(scored) < 2:
                return {"avg_score": None, "direction": "flat", "recent_count": len(scored)}

            scores = [i["voice_score"] for i in scored[:5]]
            avg = sum(scores) / len(scores)
            # Direction: compare first half vs second half
            mid = len(scores) // 2
            direction = "up" if sum(scores[:mid]) / max(mid, 1) < sum(scores[mid:]) / max(len(scores) - mid, 1) else "down"
            return {"avg_score": round(avg, 1), "direction": direction, "recent_count": len(scored)}
        except Exception:
            return {"avg_score": None, "direction": "flat", "recent_count": 0}

    async def _competitors():
        try:
            profiles = await asyncio.to_thread(firebase_service.get_competitor_profiles, project_id)
            snapshots = await asyncio.to_thread(firebase_service.get_competitor_snapshots, project_id)
            return max(len(profiles), len(snapshots))
        except Exception:
            return 0

    async def _active_campaign():
        try:
            campaigns = await asyncio.to_thread(firebase_service.list_campaigns, project_id, 10)
            ready = [c for c in campaigns if c.get("status") == "ready"]
            if not ready:
                return None
            c = ready[0]
            return {"id": c.get("id"), "name": c.get("name", ""), "status": c.get("status")}
        except Exception:
            return None

    async def _top_content_type():
        try:
            items = await asyncio.to_thread(
                firebase_service.list_content_library_items,
                project_id, None, "posted", None, 50
            )
            type_counts: dict[str, int] = {}
            for item in items:
                t = f"{item.get('platform', '')} {item.get('type', '')}".strip()
                if t:
                    type_counts[t] = type_counts.get(t, 0) + 1
            if not type_counts:
                return None
            return max(type_counts, key=lambda k: type_counts[k])
        except Exception:
            return None

    alerts, voice_trend, competitor_count, active_campaign, top_content_type = await asyncio.gather(
        _alerts(), _voice_trend(), _competitors(), _active_campaign(), _top_content_type()
    )

    return {
        "recent_alerts": alerts,
        "voice_trend": voice_trend,
        "competitor_count": competitor_count,
        "active_campaign": active_campaign,
        "top_content_type": top_content_type,
    }
