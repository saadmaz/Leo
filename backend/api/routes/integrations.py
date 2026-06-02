"""
Integrations routes — GA4 and GSC per-project configuration.

GA4 endpoints:
  GET  /projects/{id}/integrations/ga4/status     — is service account configured + property set
  POST /projects/{id}/integrations/ga4/property   — save a property ID to the project
  GET  /projects/{id}/integrations/ga4/overview   — live session metrics
  GET  /projects/{id}/integrations/ga4/sessions   — daily sessions time-series
  GET  /projects/{id}/integrations/ga4/sources    — traffic source breakdown
  GET  /projects/{id}/integrations/ga4/pages      — top pages by pageviews

GSC endpoints (OAuth auth lives in blog.py; data lives here):
  GET  /projects/{id}/integrations/gsc/status     — connection status, domain, last sync
  GET  /projects/{id}/integrations/gsc/queries    — top search queries with is_quick_win flag
  GET  /projects/{id}/integrations/gsc/pages      — top pages from GSC
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_editor, get_project_as_member, require_tier
from backend.middleware.auth import CurrentUser
from backend.services import firebase_service, ga4_service
from backend.services.blog import gsc_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/integrations", tags=["integrations"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SetGA4PropertyRequest(BaseModel):
    property_id: str = Field(..., min_length=1, max_length=50, pattern=r"^\d+$")


class GSCStatus(BaseModel):
    connected: bool
    domain: Optional[str] = None
    last_synced: Optional[str] = None


class GSCQuery(BaseModel):
    query: str
    impressions: int
    clicks: int
    ctr: float
    avg_position: float
    is_quick_win: bool


# ---------------------------------------------------------------------------
# GA4 — status + configuration
# ---------------------------------------------------------------------------

@router.get("/ga4/status")
async def ga4_status(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Return whether the GA4 service account is configured and which property ID is set."""
    project = get_project_as_member(project_id, user["uid"])
    return ga4_service.get_status(project)


@router.post("/ga4/property")
async def set_ga4_property(
    project_id: str,
    body: SetGA4PropertyRequest,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Save the user's GA4 property ID to the project document."""
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(
        firebase_service.update_project,
        project_id,
        {"ga4PropertyId": body.property_id},
    )
    return {"ok": True, "property_id": body.property_id}


@router.delete("/ga4/property")
async def clear_ga4_property(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Remove the GA4 property ID from the project document."""
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(
        firebase_service.update_project,
        project_id,
        {"ga4PropertyId": None},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# GA4 — live data
# ---------------------------------------------------------------------------

@router.get("/ga4/overview")
async def ga4_overview(
    project_id: str,
    user: CurrentUser,
    days: int = Query(30, ge=7, le=365),
    _tier: None = require_tier("pro"),
):
    """Aggregate session metrics for the last N days from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured for this project.")
    if not ga4_service.is_configured():
        raise HTTPException(status_code=503, detail="GA4 service account not configured on this server.")
    return await ga4_service.get_overview(property_id, days=days)


@router.get("/ga4/sessions")
async def ga4_sessions_over_time(
    project_id: str,
    user: CurrentUser,
    days: int = Query(30, ge=7, le=90),
    _tier: None = require_tier("pro"),
):
    """Daily sessions time-series from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    if not ga4_service.is_configured():
        raise HTTPException(status_code=503, detail="GA4 service account not configured.")
    rows = await ga4_service.get_sessions_over_time(property_id, days=days)
    return {"rows": rows, "days": days}


@router.get("/ga4/sources")
async def ga4_traffic_sources(
    project_id: str,
    user: CurrentUser,
    days: int = Query(30, ge=7, le=90),
    _tier: None = require_tier("pro"),
):
    """Sessions by channel grouping from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    if not ga4_service.is_configured():
        raise HTTPException(status_code=503, detail="GA4 service account not configured.")
    rows = await ga4_service.get_traffic_sources(property_id, days=days)
    return {"rows": rows, "days": days}


@router.get("/ga4/pages")
async def ga4_top_pages(
    project_id: str,
    user: CurrentUser,
    days: int = Query(30, ge=7, le=90),
    limit: int = Query(10, ge=1, le=25),
    _tier: None = require_tier("pro"),
):
    """Top pages by pageviews from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    if not ga4_service.is_configured():
        raise HTTPException(status_code=503, detail="GA4 service account not configured.")
    rows = await ga4_service.get_top_pages(property_id, days=days, limit=limit)
    return {"rows": rows, "days": days}


# ---------------------------------------------------------------------------
# GSC — status + data (OAuth auth lives in blog.py)
# ---------------------------------------------------------------------------

async def _gsc_search_analytics(
    project_id: str,
    uid: str,
    dimensions: list[str],
    days: int,
    limit: int,
    row_limit: int = 25,
) -> list[dict]:
    """
    Generic GSC searchAnalytics query.
    Wraps the existing gsc_service token/refresh infrastructure.
    """
    from datetime import date, timedelta
    tokens = gsc_service.get_tokens(project_id, uid)
    if not tokens:
        return []

    properties = await gsc_service.list_properties(project_id, uid)
    if not properties:
        return []
    site_url = properties[0]

    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    import httpx
    try:
        access_token = await gsc_service.refresh_access_token(tokens["refresh_token"])
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{site_url}/searchAnalytics/query",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "startDate": str(start_date),
                    "endDate": str(end_date),
                    "dimensions": dimensions,
                    "rowLimit": row_limit,
                    "orderBy": [{"fieldName": "impressions", "sortOrder": "descending"}],
                },
            )
            resp.raise_for_status()
            rows = resp.json().get("rows", [])
            return rows[:limit]
    except Exception as exc:
        logger.error("GSC searchAnalytics failed for project %s: %s", project_id, exc)
        return []


@router.get("/gsc/status", response_model=GSCStatus)
async def gsc_integration_status(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """
    Return GSC connection status, the first verified domain, and last sync time.
    Uses tokens stored by the blog.py OAuth callback.
    """
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        return GSCStatus(connected=False)

    # Derive the primary domain from the first listed property
    try:
        properties = await gsc_service.list_properties(project_id, user["uid"])
        domain = properties[0] if properties else None
    except Exception:
        domain = None

    return GSCStatus(
        connected=True,
        domain=domain,
        last_synced=tokens.get("updated_at") or tokens.get("connected_at"),
    )


@router.get("/gsc/queries")
async def gsc_top_queries(
    project_id: str,
    user: CurrentUser,
    days: int = Query(90, ge=7, le=365),
    limit: int = Query(50, ge=1, le=200),
    _tier: None = require_tier("pro"),
):
    """
    Top search queries from GSC ordered by impressions.
    Returns list of GSCQuery with is_quick_win flag.
    is_quick_win: impressions > 100 AND raw CTR < 0.02 (< 2%).
    """
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Search Console not connected.")

    raw = await _gsc_search_analytics(
        project_id, user["uid"],
        dimensions=["query"],
        days=days,
        limit=limit,
        row_limit=min(limit, 200),
    )
    queries = []
    for r in raw:
        raw_ctr = r.get("ctr", 0.0)
        impressions = int(r.get("impressions", 0))
        queries.append(GSCQuery(
            query=r["keys"][0],
            clicks=int(r.get("clicks", 0)),
            impressions=impressions,
            ctr=round(raw_ctr * 100, 2),        # returned as percentage for display
            avg_position=round(r.get("position", 0.0), 1),
            is_quick_win=impressions > 100 and raw_ctr < 0.02,
        ))
    return {"queries": [q.model_dump() for q in queries], "days": days}


@router.get("/gsc/pages")
async def gsc_top_pages(
    project_id: str,
    user: CurrentUser,
    days: int = Query(28, ge=7, le=90),
    limit: int = Query(20, ge=1, le=50),
    _tier: None = require_tier("pro"),
):
    """
    Top pages from GSC ordered by impressions.
    Returns list of { page, clicks, impressions, ctr, position }.
    """
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Search Console not connected.")

    raw = await _gsc_search_analytics(
        project_id, user["uid"],
        dimensions=["page"],
        days=days,
        limit=limit,
        row_limit=min(limit, 200),
    )
    return {
        "pages": [
            {
                "page": r["keys"][0],
                "clicks": int(r.get("clicks", 0)),
                "impressions": int(r.get("impressions", 0)),
                "ctr": round(r.get("ctr", 0) * 100, 2),
                "avg_position": round(r.get("position", 0.0), 1),
            }
            for r in raw
        ],
        "days": days,
    }
