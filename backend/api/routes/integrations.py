"""
Integrations routes — GA4 OAuth + GSC data.

Two routers are exported:
  router      — prefix /projects/{project_id}/integrations  (data endpoints)
  auth_router — no prefix                                    (OAuth callbacks)

GA4 OAuth flow:
  GET  /auth/ga4/url                          — generate Google OAuth URL
  GET  /auth/ga4/callback                     — exchange code, store tokens, redirect
  DELETE /projects/{id}/integrations/ga4      — disconnect (delete tokens + property)

GA4 data (per-user OAuth, require_tier pro):
  GET  /projects/{id}/integrations/ga4/status      — connected?, property_id, last_synced
  POST /projects/{id}/integrations/ga4/property    — save property ID to project doc
  GET  /projects/{id}/integrations/ga4/metrics     — sessions/users/pageviews + daily chart
  GET  /projects/{id}/integrations/ga4/pages       — top pages
  GET  /projects/{id}/integrations/ga4/sources     — traffic sources
  GET  /projects/{id}/integrations/ga4/conversions — conversion events
  POST /projects/{id}/integrations/ga4/refresh-cache — invalidate 6h cache

GSC data (OAuth auth lives in blog.py, data here):
  GET  /projects/{id}/integrations/gsc/status   — connected?, domain, last_synced
  GET  /projects/{id}/integrations/gsc/queries  — top queries with is_quick_win
  GET  /projects/{id}/integrations/gsc/pages    — top pages
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_editor, get_project_as_member, require_tier
from backend.config import settings
from backend.middleware.auth import CurrentUser
from backend.services import firebase_service, ga4_service
from backend.services.blog import gsc_service

logger = logging.getLogger(__name__)

# Data endpoints — project-scoped
router = APIRouter(prefix="/projects/{project_id}/integrations", tags=["integrations"])

# OAuth endpoints — top-level (no project prefix, no auth required for callback)
auth_router = APIRouter(tags=["integrations-auth"])

_GA4_CALLBACK_PATH = "/api/backend/auth/ga4/callback"


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SetGA4PropertyRequest(BaseModel):
    property_id: str = Field(..., min_length=1, max_length=50, pattern=r"^\d+$")


class GA4StatusResponse(BaseModel):
    connected: bool
    property_id: Optional[str] = None
    last_synced: Optional[str] = None


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
# GA4 OAuth — auth_router (no prefix)
# ---------------------------------------------------------------------------

@auth_router.get("/auth/ga4/url")
async def get_ga4_auth_url(
    project_id: str = Query(...),
    redirect_uri: str = Query(...),
    user: CurrentUser = None,
):
    """Return the Google OAuth2 URL for GA4 authorisation."""
    if not settings.GA4_OAUTH_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GA4 OAuth not configured on this server.")
    url = ga4_service.get_auth_url(user["uid"], project_id, redirect_uri)
    return {"url": url}


@auth_router.get("/auth/ga4/callback")
async def ga4_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """
    Google redirects here after user authorises.
    Exchanges code for tokens, stores them, then redirects to integrations page.
    No auth required — Google calls this directly.
    """
    if not settings.GA4_OAUTH_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GA4 OAuth not configured.")

    try:
        decoded = ga4_service.decode_state(state)
        project_id = decoded["project_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state parameter.")

    redirect_uri = f"{settings.FRONTEND_URL.rstrip('/')}{_GA4_CALLBACK_PATH}"

    try:
        result = await ga4_service.exchange_code(code, state, redirect_uri)
        project_id = result["project_id"]
    except Exception as exc:
        logger.error("GA4 token exchange failed: %s", exc)
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/projects/{project_id}/settings/integrations?ga4_error=1"
        )

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/projects/{project_id}/settings/integrations?connected=ga4"
    )


# ---------------------------------------------------------------------------
# GA4 data — router (project-scoped)
# ---------------------------------------------------------------------------

@router.delete("/ga4")
async def disconnect_ga4(
    project_id: str,
    user: CurrentUser,
):
    """Delete stored GA4 tokens and remove property ID from project."""
    get_project_as_member(project_id, user["uid"])

    # Clear tokens
    await asyncio.to_thread(ga4_service.delete_tokens, project_id, user["uid"])

    # Clear property ID from project doc
    await asyncio.to_thread(
        firebase_service.update_project,
        project_id,
        {"ga4PropertyId": None},
    )

    # Evict any cached GA4 data for this user
    project = await asyncio.to_thread(firebase_service.get_project, project_id) or {}
    property_id = project.get("ga4PropertyId")
    if property_id:
        ga4_service.clear_cache(user["uid"], property_id)

    return {"success": True}


@router.get("/ga4/status", response_model=GA4StatusResponse)
async def ga4_status(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Return GA4 connection status, property ID, and last sync time."""
    get_project_as_member(project_id, user["uid"])
    status = await asyncio.to_thread(ga4_service.get_status, project_id, user["uid"])
    return GA4StatusResponse(**status)


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


@router.get("/ga4/metrics")
async def ga4_metrics(
    project_id: str,
    user: CurrentUser,
    start_date: str = Query("30daysAgo"),
    end_date: str = Query("today"),
    _tier: None = require_tier("pro"),
):
    """Aggregate session metrics + daily chart data from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured for this project.")
    return await ga4_service.get_session_metrics(
        project_id, user["uid"], property_id, start_date, end_date
    )


@router.get("/ga4/pages")
async def ga4_top_pages(
    project_id: str,
    user: CurrentUser,
    limit: int = Query(10, ge=1, le=25),
    _tier: None = require_tier("pro"),
):
    """Top pages by sessions from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    return await ga4_service.get_top_pages(project_id, user["uid"], property_id, limit)


@router.get("/ga4/sources")
async def ga4_traffic_sources(
    project_id: str,
    user: CurrentUser,
    start_date: str = Query("30daysAgo"),
    end_date: str = Query("today"),
    _tier: None = require_tier("pro"),
):
    """Traffic sources by channel group from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    return await ga4_service.get_traffic_sources(
        project_id, user["uid"], property_id, start_date, end_date
    )


@router.get("/ga4/conversions")
async def ga4_conversions(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Key conversion events from GA4."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        raise HTTPException(status_code=400, detail="GA4 property ID not configured.")
    return await ga4_service.get_conversion_events(project_id, user["uid"], property_id)


@router.post("/ga4/refresh-cache")
async def ga4_refresh_cache(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Invalidate all cached GA4 responses for this project + user."""
    project = get_project_as_member(project_id, user["uid"])
    property_id = project.get("ga4PropertyId")
    if not property_id:
        return {"ok": True, "cleared": 0}
    cleared = ga4_service.clear_cache(user["uid"], property_id)
    return {"ok": True, "cleared": cleared}


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
    from datetime import date, timedelta
    import httpx as _httpx

    tokens = gsc_service.get_tokens(project_id, uid)
    if not tokens:
        return []

    properties = await gsc_service.list_properties(project_id, uid)
    if not properties:
        return []
    site_url = properties[0]

    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    try:
        access_token = await gsc_service.refresh_access_token(tokens["refresh_token"])
        async with _httpx.AsyncClient(timeout=20.0) as client:
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
    """Return GSC connection status, first domain, and last sync time."""
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        return GSCStatus(connected=False)

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
    """Top search queries from GSC with is_quick_win flag."""
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
            ctr=round(raw_ctr * 100, 2),
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
    """Top pages from GSC by impressions."""
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


# ---------------------------------------------------------------------------
# GSC freshness audit — compare last 90 days vs prior 90 days per page
# ---------------------------------------------------------------------------

async def _gsc_page_period(
    project_id: str,
    uid: str,
    start_date: str,
    end_date: str,
    row_limit: int = 200,
) -> dict[str, dict]:
    """
    Fetch GSC page-level data for a specific date range.
    Returns dict keyed by page URL.
    """
    from datetime import date
    tokens = gsc_service.get_tokens(project_id, uid)
    if not tokens:
        return {}

    properties = await gsc_service.list_properties(project_id, uid)
    if not properties:
        return {}
    site_url = properties[0]

    import httpx as _httpx
    try:
        access_token = await gsc_service.refresh_access_token(tokens["refresh_token"])
        async with _httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{site_url}/searchAnalytics/query",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "startDate": start_date,
                    "endDate": end_date,
                    "dimensions": ["page"],
                    "rowLimit": row_limit,
                    "orderBy": [{"fieldName": "impressions", "sortOrder": "descending"}],
                },
            )
            resp.raise_for_status()
            rows = resp.json().get("rows", [])
    except Exception as exc:
        logger.error("GSC freshness period query failed: %s", exc)
        return {}

    return {
        r["keys"][0]: {
            "impressions": int(r.get("impressions", 0)),
            "clicks": int(r.get("clicks", 0)),
            "position": round(r.get("position", 0.0), 1),
        }
        for r in rows
    }


@router.get("/gsc/freshness-audit")
async def gsc_freshness_audit(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """
    Compare last 90 days vs prior 90 days GSC impressions per page.
    Returns pages sorted by most negative impression delta (most urgent first).
    """
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Search Console not connected.")

    from datetime import date, timedelta
    today = date.today()
    current_end = str(today)
    current_start = str(today - timedelta(days=90))
    prior_end = str(today - timedelta(days=91))
    prior_start = str(today - timedelta(days=181))

    current, prior = await asyncio.gather(
        _gsc_page_period(project_id, user["uid"], current_start, current_end),
        _gsc_page_period(project_id, user["uid"], prior_start, prior_end),
    )

    results = []
    all_pages = set(current.keys()) | set(prior.keys())

    for page in all_pages:
        cur = current.get(page, {})
        pri = prior.get(page, {})
        cur_imp = cur.get("impressions", 0)
        pri_imp = pri.get("impressions", 0)

        if pri_imp == 0 and cur_imp == 0:
            continue

        if pri_imp > 0:
            delta_pct = round((cur_imp - pri_imp) / pri_imp * 100, 1)
        elif cur_imp > 0:
            delta_pct = 100.0   # new page
        else:
            delta_pct = -100.0

        if delta_pct < -30:
            priority = "urgent"
        elif delta_pct < -10:
            priority = "moderate"
        else:
            priority = "low"

        results.append({
            "page": page,
            "current_impressions": cur_imp,
            "prior_impressions": pri_imp,
            "delta_percent": delta_pct,
            "current_clicks": cur.get("clicks", 0),
            "avg_position": cur.get("position", prior.get("position", 0.0)),
            "refresh_priority": priority,
        })

    # Sort: urgent first, then by most negative delta
    results.sort(key=lambda r: (
        0 if r["refresh_priority"] == "urgent"
        else 1 if r["refresh_priority"] == "moderate"
        else 2,
        r["delta_percent"],
    ))

    return results
