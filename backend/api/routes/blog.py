"""
Blog Module routes.

Endpoints:
  POST /projects/{id}/blog/serp-analysis          - stream SERP content analysis (SSE)
  POST /projects/{id}/blog/brief                  - stream brief generation (SSE)
  GET  /projects/{id}/blog/briefs                 - list saved briefs
  GET  /projects/{id}/blog/briefs/{brief_id}      - get a single brief
  GET  /projects/{id}/blog/cms-connections        - list WordPress connections
  POST /projects/{id}/blog/cms-connections        - add connection (test + save)
  DELETE /projects/{id}/blog/cms-connections/{id} - remove connection
  POST /projects/{id}/blog/publish                - publish to CMS
  GET  /projects/{id}/blog/rank-history           - list rank records
  POST /projects/{id}/blog/rank-history           - start tracking a post
  POST /projects/{id}/blog/rank-history/snapshot  - take a fresh snapshot
  GET  /auth/gsc/url                              - get GSC OAuth URL
  GET  /auth/gsc/callback                         - OAuth callback
  GET  /projects/{id}/blog/gsc-status             - check GSC connection status
  DELETE /projects/{id}/blog/gsc-disconnect       - remove GSC tokens

  SEO/GEO/AEO:
  POST /projects/{id}/blog/content-score          - combined SEO+GEO+AEO score for content
  POST /projects/{id}/blog/competitor-analysis    - crawl competitor blogs + gap analysis
"""
import asyncio
import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field, HttpUrl

from backend.api.deps import get_project_as_editor, get_project_as_member
from backend.config import settings
from backend.middleware.auth import CurrentUser
from backend.services.blog import (
    brief_service,
    cms_publishing_service,
    competitor_blog_service,
    gsc_service,
    rank_tracker_service,
    serp_content_service,
)
from backend.services import geo_aeo_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["blog"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SERPAnalysisRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    location_code: int = Field(default=2840)


class BriefRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    serp_analysis: dict = Field(...)
    location_code: int = Field(default=2840)


class CMSConnectionRequest(BaseModel):
    site_url: str = Field(..., min_length=1, max_length=500)
    username: str = Field(..., min_length=1, max_length=200)
    app_password: str = Field(..., min_length=1, max_length=500)


class PublishRequest(BaseModel):
    connection_id: str = Field(...)
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    status: str = Field(default="draft")
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    tags: Optional[list[str]] = None


class TrackPostRequest(BaseModel):
    post_url: str = Field(...)
    target_keyword: str = Field(...)


class SnapshotRequest(BaseModel):
    post_url: str = Field(...)
    target_keyword: str = Field(...)
    gsc_site_url: Optional[str] = None


class ContentScoreRequest(BaseModel):
    content: str = Field(..., min_length=100, max_length=50000)
    keyword: str = Field(..., min_length=1, max_length=200)
    seo_score: Optional[int] = Field(default=None, ge=0, le=100)


class CompetitorBlogRequest(BaseModel):
    competitor_urls: list[str] = Field(..., min_length=1, max_length=4)
    topic_focus: Optional[str] = Field(default=None, max_length=200)


# ---------------------------------------------------------------------------
# SERP Analysis (SSE)
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/blog/serp-analysis")
async def stream_serp_analysis(
    project_id: str,
    body: SERPAnalysisRequest,
    user: CurrentUser,
):
    """Stream SERP content analysis for a keyword."""
    get_project_as_member(project_id, user["uid"])

    async def event_stream():
        async for chunk in serp_content_service.stream_serp_analysis(
            project_id=project_id,
            keyword=body.keyword,
            location_code=body.location_code,
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Brief Generation (SSE)
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/blog/brief")
async def stream_brief(
    project_id: str,
    body: BriefRequest,
    user: CurrentUser,
):
    """Stream blog content brief generation grounded in SERP analysis."""
    project = get_project_as_editor(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    async def event_stream():
        async for chunk in brief_service.stream_brief_generation(
            project_id=project_id,
            project_name=project.get("name", ""),
            brand_core=brand_core,
            keyword=body.keyword,
            serp_analysis=body.serp_analysis,
            location_code=body.location_code,
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Brief CRUD
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/blog/briefs")
async def list_briefs(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return {"briefs": brief_service.list_briefs(project_id)}


@router.get("/projects/{project_id}/blog/briefs/{brief_id}")
async def get_brief(
    project_id: str,
    brief_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    brief = brief_service.get_brief(brief_id)
    if not brief or brief.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


# ---------------------------------------------------------------------------
# CMS Connections
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/blog/cms-connections")
async def list_cms_connections(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return {"connections": cms_publishing_service.list_connections(project_id)}


@router.post("/projects/{project_id}/blog/cms-connections")
async def add_cms_connection(
    project_id: str,
    body: CMSConnectionRequest,
    user: CurrentUser,
):
    """Test WordPress credentials and save the connection."""
    get_project_as_editor(project_id, user["uid"])

    test = await cms_publishing_service.test_connection(
        body.site_url, body.username, body.app_password
    )
    if not test["ok"]:
        raise HTTPException(status_code=400, detail=f"WordPress connection failed: {test.get('error')}")

    connection = await asyncio.to_thread(
        cms_publishing_service.save_connection,
        project_id, body.site_url, body.username, body.app_password,
    )
    return {**connection, "display_name": test.get("display_name"), "site_name": test.get("site_name")}


@router.delete("/projects/{project_id}/blog/cms-connections/{conn_id}")
async def remove_cms_connection(
    project_id: str,
    conn_id: str,
    user: CurrentUser,
):
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(cms_publishing_service.delete_connection, conn_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# CMS Publishing
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/blog/publish")
async def publish_to_cms(
    project_id: str,
    body: PublishRequest,
    user: CurrentUser,
):
    get_project_as_editor(project_id, user["uid"])

    result = await cms_publishing_service.publish_post(
        connection_id=body.connection_id,
        title=body.title,
        content=body.content,
        status=body.status,
        slug=body.slug,
        excerpt=body.excerpt,
        tags=body.tags,
    )
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Publish failed"))
    return result


# ---------------------------------------------------------------------------
# Rank Tracking
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/blog/rank-history")
async def list_rank_history(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    return {"records": rank_tracker_service.list_rank_records(project_id)}


@router.post("/projects/{project_id}/blog/rank-history")
async def start_tracking(
    project_id: str,
    body: TrackPostRequest,
    user: CurrentUser,
):
    """Register a post URL for rank tracking."""
    get_project_as_editor(project_id, user["uid"])
    record = await asyncio.to_thread(
        rank_tracker_service.upsert_rank_record,
        project_id, body.post_url, body.target_keyword, "pending",
    )
    return record


@router.post("/projects/{project_id}/blog/rank-history/snapshot")
async def take_rank_snapshot(
    project_id: str,
    body: SnapshotRequest,
    user: CurrentUser,
):
    """Take a fresh rank snapshot for a tracked post."""
    get_project_as_editor(project_id, user["uid"])
    snapshot = await rank_tracker_service.take_snapshot(
        project_id=project_id,
        post_url=body.post_url,
        target_keyword=body.target_keyword,
        uid=user["uid"],
        gsc_site_url=body.gsc_site_url,
    )
    return snapshot


# ---------------------------------------------------------------------------
# GSC OAuth
# ---------------------------------------------------------------------------

_GSC_REDIRECT_PATH = "/api/backend/auth/gsc/callback"


@router.get("/auth/gsc/url")
async def get_gsc_auth_url(
    project_id: str = Query(...),
    user: CurrentUser = None,
    request: Request = None,
):
    """Return the Google OAuth2 URL for GSC authorisation."""
    if not settings.GOOGLE_SEARCH_CONSOLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Search Console not configured")

    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}{_GSC_REDIRECT_PATH}"
    state = f"{project_id}:{user['uid']}"
    url = gsc_service.get_auth_url(state, redirect_uri)
    return {"auth_url": url}


@router.get("/auth/gsc/callback")
async def gsc_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    request: Request = None,
):
    """Google redirects here after user authorises. Stores tokens and redirects to frontend."""
    if not settings.GOOGLE_SEARCH_CONSOLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Search Console not configured")

    try:
        project_id, uid = state.split(":", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}{_GSC_REDIRECT_PATH}"

    try:
        tokens = await gsc_service.exchange_code(code, redirect_uri)
        gsc_service.save_tokens(project_id, uid, tokens)
    except Exception as exc:
        logger.error("GSC token exchange failed: %s", exc)
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/projects/{project_id}/settings/integrations?gsc_error=1"
        )

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/projects/{project_id}/settings/integrations?gsc_connected=1"
    )


@router.get("/projects/{project_id}/blog/gsc-status")
async def gsc_status(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_member(project_id, user["uid"])
    tokens = gsc_service.get_tokens(project_id, user["uid"])
    if not tokens:
        return {"connected": False}
    properties = await gsc_service.list_properties(project_id, user["uid"])
    return {"connected": True, "properties": properties}


@router.delete("/projects/{project_id}/blog/gsc-disconnect")
async def gsc_disconnect(
    project_id: str,
    user: CurrentUser,
):
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(gsc_service.delete_tokens, project_id, user["uid"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# SEO / GEO / AEO Content Scoring
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/blog/content-score")
async def score_content(
    project_id: str,
    body: ContentScoreRequest,
    user: CurrentUser,
):
    """
    Score a piece of content across SEO, GEO (Generative Engine Optimization),
    and AEO (Answer Engine Optimization).

    Returns combined_score (0-100) + per-dimension breakdowns + improvement suggestions.
    """
    get_project_as_member(project_id, user["uid"])
    result = await geo_aeo_service.combined_content_score(
        content=body.content,
        keyword=body.keyword,
        project_id=project_id,
        seo_score=body.seo_score,
    )
    return result


# ---------------------------------------------------------------------------
# Competitor Blog Analysis
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/blog/competitor-analysis")
async def competitor_blog_analysis(
    project_id: str,
    body: CompetitorBlogRequest,
    user: CurrentUser,
):
    """
    Crawl competitor blog indexes and analyse their content strategy.
    Returns topic gaps the brand should fill, format recommendations,
    and per-competitor theme breakdowns.
    """
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    result = await competitor_blog_service.analyse_competitor_blogs(
        project_id=project_id,
        brand_core=brand_core,
        competitor_urls=body.competitor_urls,
        topic_focus=body.topic_focus,
    )
    return result
