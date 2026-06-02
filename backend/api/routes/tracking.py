"""
Leo Analytics Tracking routes.

Public ingest endpoint (no auth, CORS open):
  POST /t/v1/e          — receive a tracking event from the JS snippet

Project management endpoints (auth required, Pro+ tier):
  GET  /projects/{id}/tracking/status      — is tracking enabled? token? stats summary
  POST /projects/{id}/tracking/enable      — generate token, enable tracking
  POST /projects/{id}/tracking/disable     — disable tracking
  GET  /projects/{id}/tracking/stats       — aggregated pageviews, sessions, pages, sources
  GET  /projects/{id}/tracking/insights    — AI insights from tracking data
  GET  /track.js                           — serve the Leo tracking script
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_editor, get_project_as_member, require_tier
from backend.middleware.auth import CurrentUser
from backend.services import tracking_service

logger = logging.getLogger(__name__)

# Project-scoped routes (auth required)
router = APIRouter(prefix="/projects/{project_id}/tracking", tags=["tracking"])

# Public routes (no prefix, no auth)
public_router = APIRouter(tags=["tracking-public"])


# ---------------------------------------------------------------------------
# Tracking script — served as JavaScript
# ---------------------------------------------------------------------------

_TRACK_JS = """/* Leo Analytics — v1.0 */
(function(){
  var d=document,w=window,s=d.currentScript||d.querySelector('script[data-token]');
  if(!s)return;
  var token=s.getAttribute('data-token');
  if(!token)return;

  var sid=(function(){
    var k='_lt_sid',v=sessionStorage.getItem(k);
    if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(k,v);}
    return v;
  })();

  function send(type,extra){
    if(navigator.doNotTrack==='1')return;
    var payload={
      token:token,type:type,
      url:location.href,referrer:d.referrer||'',
      title:d.title,session_id:sid,
      screen:w.screen.width+'x'+w.screen.height,
      ua:navigator.userAgent
    };
    Object.assign(payload,extra||{});
    var endpoint='/api/backend/t/v1/e';
    if(navigator.sendBeacon){navigator.sendBeacon(endpoint,JSON.stringify(payload));}
    else{fetch(endpoint,{method:'POST',body:JSON.stringify(payload),keepalive:true}).catch(function(){});}
  }

  // Pageview on load
  if(d.readyState==='complete'||d.readyState==='interactive'){send('pageview');}
  else{d.addEventListener('DOMContentLoaded',function(){send('pageview');});}

  // SPA route change support
  var lastUrl=location.href;
  var obs=new MutationObserver(function(){
    if(location.href!==lastUrl){lastUrl=location.href;setTimeout(function(){send('pageview');},300);}
  });
  obs.observe(d.body||d.documentElement,{childList:true,subtree:true});

  // Expose manual event tracker
  w.leo=w.leo||{};
  w.leo.track=function(name,props){send('event',{name:name,props:JSON.stringify(props||{})});};
})();
"""

_TRACK_JS_HEADERS = {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
}


@public_router.get("/track.js", include_in_schema=False)
async def serve_tracking_script():
    """Serve the Leo Analytics tracking script."""
    return Response(content=_TRACK_JS, headers=_TRACK_JS_HEADERS)


# ---------------------------------------------------------------------------
# Event ingest — no auth, open CORS, must be fast
# ---------------------------------------------------------------------------

class TrackEventPayload(BaseModel):
    token: str = Field(..., min_length=1, max_length=80)
    type: str = Field(default="pageview", max_length=32)
    url: str = Field(default="", max_length=512)
    referrer: str = Field(default="", max_length=512)
    title: str = Field(default="", max_length=200)
    session_id: str = Field(default="", max_length=64)
    screen: str = Field(default="", max_length=32)
    ua: str = Field(default="", max_length=512)
    name: str = Field(default="", max_length=64)
    props: str = Field(default="{}", max_length=512)


@public_router.post("/t/v1/e", include_in_schema=False)
async def ingest_event(payload: TrackEventPayload, request: Request):
    """
    High-throughput event ingest endpoint.
    - No authentication (open to all origins)
    - Rate-limited by SlowAPI at a generous limit
    - Returns 204 No Content always (even on error) to avoid client-side noise
    """
    project_id = await asyncio.to_thread(
        tracking_service.resolve_token_to_project, payload.token
    )
    if project_id:
        event = payload.model_dump(exclude={"token"})
        await asyncio.to_thread(tracking_service.ingest_event, project_id, event)

    return Response(status_code=204, headers={"Access-Control-Allow-Origin": "*"})


@public_router.options("/t/v1/e", include_in_schema=False)
async def ingest_event_preflight():
    """CORS preflight for the ingest endpoint."""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    )


# ---------------------------------------------------------------------------
# Project tracking management
# ---------------------------------------------------------------------------

@router.get("/status")
async def tracking_status(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Return tracking configuration and a 7-day pageview summary."""
    get_project_as_member(project_id, user["uid"])
    config = await asyncio.to_thread(tracking_service.get_tracking_config, project_id)
    if not config:
        return {"enabled": False, "token": None, "created_at": None, "pageviews_7d": 0}

    pageviews_7d = 0
    if config.get("enabled"):
        stats = await tracking_service.get_stats(project_id, days=7)
        pageviews_7d = stats.get("pageviews", 0)

    return {**config, "pageviews_7d": pageviews_7d}


@router.post("/enable")
async def enable_tracking(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Generate a tracking token and enable Leo Analytics for the project."""
    get_project_as_editor(project_id, user["uid"])

    # Check if already enabled — re-use existing token
    config = await asyncio.to_thread(tracking_service.get_tracking_config, project_id)
    if config and config.get("enabled") and config.get("token"):
        return {"token": config["token"], "already_enabled": True}

    token = tracking_service.generate_tracking_token()
    await asyncio.to_thread(tracking_service.save_tracking_config, project_id, token)
    return {"token": token, "already_enabled": False}


@router.post("/disable")
async def disable_tracking(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Disable Leo Analytics tracking for the project."""
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(tracking_service.disable_tracking, project_id)
    return {"ok": True}


@router.get("/stats")
async def tracking_stats(
    project_id: str,
    user: CurrentUser,
    days: int = Query(30, ge=1, le=365),
    _tier: None = require_tier("pro"),
):
    """
    Return aggregated Leo tracking stats:
    pageviews, sessions, top pages, top sources, daily chart.
    """
    get_project_as_member(project_id, user["uid"])

    config = await asyncio.to_thread(tracking_service.get_tracking_config, project_id)
    if not config or not config.get("enabled"):
        raise HTTPException(
            status_code=400,
            detail="Leo Analytics not enabled for this project.",
        )

    return await tracking_service.get_stats(project_id, days=days)


@router.post("/insights")
async def tracking_insights(
    project_id: str,
    user: CurrentUser,
    _tier: None = require_tier("pro"),
):
    """Generate AI insights from Leo tracking data."""
    get_project_as_member(project_id, user["uid"])

    config = await asyncio.to_thread(tracking_service.get_tracking_config, project_id)
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=400, detail="Leo Analytics not enabled.")

    stats = await tracking_service.get_stats(project_id, days=30)
    insights = await tracking_service.generate_tracking_insights(project_id, stats)
    return {"insights": insights}
