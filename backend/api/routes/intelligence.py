"""
Intelligence routes — Phase 1.

Endpoints:
  POST /projects/{id}/brand-voice/score     — Score text against Brand Core
  POST /projects/{id}/content/predict       — Predict content performance
  POST /projects/{id}/intelligence/refresh  — Scrape + analyse competitors (SSE)
  GET  /projects/{id}/intelligence          — Get stored competitor snapshots
  POST /projects/{id}/memory/feedback       — Record user feedback on AI output
  GET  /projects/{id}/memory                — Get brand memory summary
  POST /projects/{id}/drift/check           — Check for brand voice drift
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_member, get_project_as_editor
from backend.middleware.auth import CurrentUser
from backend.services import firebase_service, intelligence_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["intelligence"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ScoreBrandVoiceRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=5000)


class PredictPerformanceRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)
    platform: str = Field(..., min_length=1, max_length=64)


class CompetitorProfile(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    tiktok: Optional[str] = None


class RefreshIntelligenceRequest(BaseModel):
    competitors: list[CompetitorProfile] = Field(..., min_length=1, max_length=5)


class MemoryFeedbackRequest(BaseModel):
    type: str = Field(..., pattern="^(edit|approve|reject|instruction)$")
    original: Optional[str] = Field(None, max_length=500)
    edited: Optional[str] = Field(None, max_length=500)
    reason: Optional[str] = Field(None, max_length=300)
    instruction: Optional[str] = Field(None, max_length=300)
    platform: Optional[str] = Field(None, max_length=64)
    context: Optional[str] = Field(None, max_length=200)


class DriftCheckRequest(BaseModel):
    own_content: list[str] = Field(..., min_length=1, max_length=20)


# ---------------------------------------------------------------------------
# Brand Voice Scorer
# ---------------------------------------------------------------------------

@router.post("/brand-voice/score")
async def score_brand_voice(
    project_id: str,
    body: ScoreBrandVoiceRequest,
    user: CurrentUser,
):
    """Score any text against the project's Brand Core."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore")

    if not brand_core:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand Core not set up. Run brand ingestion first.",
        )

    try:
        result = await intelligence_service.score_brand_voice(body.text, brand_core)
        return result
    except Exception as exc:
        logger.error("Brand voice scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Content Performance Predictor
# ---------------------------------------------------------------------------

@router.post("/content/predict")
async def predict_performance(
    project_id: str,
    body: PredictPerformanceRequest,
    user: CurrentUser,
):
    """Predict how content will perform on a given platform."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    try:
        result = await intelligence_service.predict_performance(
            body.content, body.platform, brand_core
        )
        return result
    except Exception as exc:
        logger.error("Performance prediction failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Competitive Intelligence
# ---------------------------------------------------------------------------

@router.post("/intelligence/refresh")
async def refresh_intelligence(
    project_id: str,
    body: RefreshIntelligenceRequest,
    user: CurrentUser,
):
    """
    Scrape competitor social profiles and store intelligence snapshots.
    This is a synchronous operation that may take 30–90 seconds per competitor.
    """
    get_project_as_editor(project_id, user["uid"])

    competitors = [c.model_dump() for c in body.competitors]
    try:
        result = await intelligence_service.refresh_competitor_intelligence(
            project_id, competitors
        )
        # Run web enrichment in parallel (non-blocking) when search keys are available
        from backend.config import settings as _settings
        if _settings.EXA_API_KEY or _settings.TAVILY_API_KEY:
            import asyncio as _asyncio
            _asyncio.create_task(
                intelligence_service.refresh_competitor_intelligence_web(project_id, competitors)
            )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Intelligence refresh failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/intelligence")
async def get_intelligence(
    project_id: str,
    user: CurrentUser,
):
    """Return stored competitor snapshots for this project."""
    get_project_as_member(project_id, user["uid"])

    snapshots = await asyncio.to_thread(
        firebase_service.get_competitor_snapshots, project_id
    )
    return {"snapshots": snapshots}


# ---------------------------------------------------------------------------
# Brand Memory
# ---------------------------------------------------------------------------

@router.post("/memory/feedback")
async def record_feedback(
    project_id: str,
    body: MemoryFeedbackRequest,
    user: CurrentUser,
):
    """Record feedback on AI-generated content to build brand memory."""
    get_project_as_member(project_id, user["uid"])

    feedback_data = body.model_dump(exclude_none=True)
    feedback_data["userId"] = user["uid"]

    await asyncio.to_thread(firebase_service.save_memory_feedback, project_id, feedback_data)
    return {"saved": True}


@router.get("/memory")
async def get_memory(
    project_id: str,
    user: CurrentUser,
):
    """Return a summary of what LEO has learned for this project."""
    get_project_as_member(project_id, user["uid"])

    items = await asyncio.to_thread(firebase_service.get_memory_feedback, project_id, 50)
    summary = intelligence_service.build_memory_context(items)
    return {"items": items, "summary": summary, "count": len(items)}


# ---------------------------------------------------------------------------
# Brand Drift Detector
# ---------------------------------------------------------------------------

@router.post("/drift/check")
async def check_drift(
    project_id: str,
    body: DriftCheckRequest,
    user: CurrentUser,
):
    """
    Analyse recent content against the Brand Core to detect voice drift.
    Pass in your last 10–20 post texts as own_content.
    """
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore")

    if not brand_core:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand Core not set up. Run brand ingestion first.",
        )

    try:
        result = await intelligence_service.check_brand_drift(body.own_content, brand_core)
        return result
    except Exception as exc:
        logger.error("Brand drift check failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Hashtag Research
# ---------------------------------------------------------------------------

class HashtagResearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300)
    platform: str = Field(..., min_length=1, max_length=64)
    content: Optional[str] = Field(None, max_length=2000)


@router.post("/hashtags/suggest")
async def suggest_hashtags(
    project_id: str,
    body: HashtagResearchRequest,
    user: CurrentUser,
):
    """
    Generate a tiered hashtag strategy for the given topic and platform.
    Returns hashtags grouped by tier: mega (1M+), large (100k-1M), medium (10k-100k), niche (<10k).
    """
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    try:
        from backend.config import settings as _settings
        if _settings.EXA_API_KEY or _settings.TAVILY_API_KEY:
            result = await intelligence_service.research_hashtags_enriched(
                body.topic, body.platform, body.content or "", brand_core,
                project_id=project_id,
            )
        else:
            result = await intelligence_service.research_hashtags(
                body.topic, body.platform, body.content or "", brand_core
            )
        return result
    except Exception as exc:
        logger.error("Hashtag research failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# AI Proactive Insights
# ---------------------------------------------------------------------------

@router.get("/insights")
async def get_insights(
    project_id: str,
    user: CurrentUser,
):
    """
    Generate 3-5 proactive AI insights by analysing brand memory, performance data,
    competitor snapshots, calendar, and library. Returns actionable recommendations.
    """
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    # Gather context from Firestore
    memory_items = await asyncio.to_thread(firebase_service.get_memory_feedback, project_id, 20)
    competitor_snapshots = await asyncio.to_thread(firebase_service.get_competitor_snapshots, project_id)
    analytics = await asyncio.to_thread(firebase_service.get_project_analytics, project_id)

    try:
        result = await intelligence_service.generate_insights(
            project_name=project.get("name", ""),
            brand_core=brand_core,
            memory_items=memory_items,
            competitor_snapshots=competitor_snapshots,
            analytics=analytics,
        )
        return result
    except Exception as exc:
        logger.error("Insights generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
