"""
Google Analytics 4 Service.

Mirrors backend/services/blog/gsc_service.py exactly in structure.

OAuth flow:
  1. GET /auth/ga4/url?project_id=X  → returns redirect URL to Google
  2. User authorises in browser (same-tab redirect required by GA4)
  3. Google redirects to /auth/ga4/callback?code=...&state=<base64-json>
  4. Tokens stored in Firestore user_integrations (type=google_analytics4)
  5. Data queries use stored refresh token + BetaAnalyticsDataClient

Token storage: user_integrations/{uid}_google_analytics4_{project_id}
Property ID storage: projects/{project_id}.ga4PropertyId

Caching: all Data API responses cached 6 hours (TTL_GA4_DATA).
Cache keys: "ga4:{uid}:{property_id}:{method}:{date_range}"
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

_GA4_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GA4_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
_INTEGRATION_TYPE = "google_analytics4"


# ---------------------------------------------------------------------------
# OAuth helpers  (mirror gsc_service.py exactly)
# ---------------------------------------------------------------------------

def get_auth_url(uid: str, project_id: str, redirect_uri: str) -> str:
    """Build the Google OAuth2 authorisation URL for GA4."""
    state = base64.urlsafe_b64encode(
        json.dumps({"uid": uid, "project_id": project_id}).encode()
    ).decode()
    params = {
        "client_id": settings.GA4_OAUTH_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": _GA4_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{_GA4_AUTH_URL}?{urlencode(params)}"


def decode_state(state: str) -> dict:
    """Decode the base64-encoded state param from the OAuth callback."""
    return json.loads(base64.urlsafe_b64decode(state.encode()).decode())


async def exchange_code(code: str, state: str, redirect_uri: str) -> dict:
    """
    Exchange an auth code for access + refresh tokens.
    Decodes state to get uid + project_id, stores tokens in Firestore.
    Returns { uid, project_id, success: True }.
    """
    decoded = decode_state(state)
    uid = decoded["uid"]
    project_id = decoded["project_id"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _GA4_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GA4_OAUTH_CLIENT_ID,
                "client_secret": settings.GA4_OAUTH_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        tokens = resp.json()

    save_tokens(project_id, uid, tokens)
    return {"uid": uid, "project_id": project_id, "success": True}


async def _refresh_access_token(refresh_token: str) -> str:
    """Use a stored refresh token to get a new access token. Returns the token string."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _GA4_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.GA4_OAUTH_CLIENT_ID,
                "client_secret": settings.GA4_OAUTH_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Firestore token storage  (mirror gsc_service.py exactly)
# ---------------------------------------------------------------------------

def _doc_id(uid: str, project_id: str) -> str:
    return f"{uid}_{_INTEGRATION_TYPE}_{project_id}"


def save_tokens(project_id: str, uid: str, tokens: dict) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        now = datetime.now(timezone.utc).isoformat()
        db.collection("user_integrations").document(_doc_id(uid, project_id)).set({
            "uid": uid,
            "project_id": project_id,
            "type": _INTEGRATION_TYPE,
            "access_token": tokens.get("access_token", ""),
            "refresh_token": tokens.get("refresh_token", ""),
            "token_expiry": tokens.get("expires_in", 3600),
            "connected_at": now,
            "updated_at": now,
        })
    except Exception as exc:
        logger.error("Failed to save GA4 tokens: %s", exc)


def get_tokens(project_id: str, uid: str) -> Optional[dict]:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        doc = db.collection("user_integrations").document(_doc_id(uid, project_id)).get()
        if not doc.exists:
            return None
        return doc.to_dict()
    except Exception:
        return None


def delete_tokens(project_id: str, uid: str) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        db.collection("user_integrations").document(_doc_id(uid, project_id)).delete()
    except Exception as exc:
        logger.warning("Failed to delete GA4 tokens: %s", exc)


# ---------------------------------------------------------------------------
# Status helper
# ---------------------------------------------------------------------------

def get_status(project_id: str, uid: str) -> dict:
    """
    Return connection status for the current user + project.
    Does NOT make any external API call.
    """
    tokens = get_tokens(project_id, uid)
    if not tokens:
        return {"connected": False, "property_id": None, "last_synced": None}

    from backend.services import firebase_service
    project = firebase_service.get_project(project_id) or {}
    property_id = project.get("ga4PropertyId")

    return {
        "connected": True,
        "property_id": property_id,
        "last_synced": tokens.get("updated_at") or tokens.get("connected_at"),
    }


# ---------------------------------------------------------------------------
# GA4 Data API — shared credential builder
# ---------------------------------------------------------------------------

async def _build_credentials(project_id: str, uid: str):
    """
    Build a google.oauth2.credentials.Credentials object from stored tokens,
    refreshing the access token if needed.
    Raises HTTPException 401 when tokens are missing or refresh fails.
    """
    from fastapi import HTTPException, status as http_status

    tokens = get_tokens(project_id, uid)
    if not tokens:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="GA4 not connected. Please connect via Settings → Integrations.",
        )

    try:
        access_token = await _refresh_access_token(tokens["refresh_token"])
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 401):
            raise HTTPException(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                detail="GA4 token expired. Please reconnect in Settings → Integrations.",
            )
        raise HTTPException(
            status_code=http_status.HTTP_502_BAD_GATEWAY,
            detail="GA4 token refresh failed. Try again later.",
        )
    except Exception as exc:
        logger.error("GA4 credential build failed for uid=%s: %s", uid, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GA4 authentication error.",
        )

    from google.oauth2.credentials import Credentials
    return Credentials(
        token=access_token,
        refresh_token=tokens["refresh_token"],
        token_uri=_GA4_TOKEN_URL,
        client_id=settings.GA4_OAUTH_CLIENT_ID,
        client_secret=settings.GA4_OAUTH_CLIENT_SECRET,
        scopes=[_GA4_SCOPE],
    )


def _ga4_client(credentials):
    """Return an authenticated BetaAnalyticsDataClient."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    return BetaAnalyticsDataClient(credentials=credentials)


# ---------------------------------------------------------------------------
# GA4 Data methods — all with 6-hour cache
# ---------------------------------------------------------------------------

def _cache_key(uid: str, property_id: str, method: str, suffix: str = "") -> str:
    return f"ga4:{uid}:{property_id}:{method}:{suffix}"


async def get_session_metrics(
    project_id: str,
    uid: str,
    property_id: str,
    start_date: str = "30daysAgo",
    end_date: str = "today",
) -> dict:
    """
    Aggregate session metrics + daily session time-series.

    Returns:
      { sessions, users, pageviews, avg_session_duration, bounce_rate,
        daily_sessions: [{ date, sessions }] }
    """
    from fastapi import HTTPException, status as http_status
    from backend.services import cache_service
    from backend.services.cache_service import TTL_GA4_DATA

    cache_k = _cache_key(uid, property_id, "metrics", f"{start_date}:{end_date}")
    cached = cache_service.get(cache_k)
    if cached is not None:
        return cached

    credentials = await _build_credentials(project_id, uid)

    import asyncio

    def _run():
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )
        client = _ga4_client(credentials)
        prop = f"properties/{property_id}"

        # 1. Aggregate totals
        agg_req = RunReportRequest(
            property=prop,
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            metrics=[
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="screenPageViews"),
                Metric(name="averageSessionDuration"),
                Metric(name="bounceRate"),
            ],
        )
        agg_resp = client.run_report(agg_req)
        totals = {"sessions": 0, "users": 0, "pageviews": 0,
                  "avg_session_duration": 0.0, "bounce_rate": 0.0}
        if agg_resp.rows:
            v = [m.value for m in agg_resp.rows[0].metric_values]
            totals = {
                "sessions": int(v[0]),
                "users": int(v[1]),
                "pageviews": int(v[2]),
                "avg_session_duration": round(float(v[3]), 1),
                "bounce_rate": round(float(v[4]) * 100, 1),
            }

        # 2. Daily sessions for chart
        daily_req = RunReportRequest(
            property=prop,
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="sessions")],
            order_bys=[OrderBy(
                dimension=OrderBy.DimensionOrderBy(dimension_name="date"),
            )],
        )
        daily_resp = client.run_report(daily_req)
        daily = [
            {
                "date": row.dimension_values[0].value,
                "sessions": int(row.metric_values[0].value),
            }
            for row in daily_resp.rows
        ]
        return {**totals, "daily_sessions": daily}

    try:
        result = await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _handle_ga4_error(exc, property_id)

    cache_service.set(cache_k, result, ttl=TTL_GA4_DATA)
    return result


async def get_top_pages(
    project_id: str,
    uid: str,
    property_id: str,
    limit: int = 10,
) -> list[dict]:
    """
    Top pages by sessions.

    Returns: [{ page, sessions, pageviews, avg_time_on_page }]
    """
    from backend.services import cache_service
    from backend.services.cache_service import TTL_GA4_DATA

    cache_k = _cache_key(uid, property_id, "pages", str(limit))
    cached = cache_service.get(cache_k)
    if cached is not None:
        return cached

    credentials = await _build_credentials(project_id, uid)

    import asyncio

    def _run():
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )
        client = _ga4_client(credentials)
        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
            dimensions=[Dimension(name="pagePath")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="screenPageViews"),
                Metric(name="averageSessionDuration"),
            ],
            order_bys=[OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True,
            )],
            limit=limit,
        )
        resp = client.run_report(req)
        return [
            {
                "page": row.dimension_values[0].value,
                "sessions": int(row.metric_values[0].value),
                "pageviews": int(row.metric_values[1].value),
                "avg_time_on_page": round(float(row.metric_values[2].value), 1),
            }
            for row in resp.rows
        ]

    try:
        result = await asyncio.to_thread(_run)
    except Exception as exc:
        _handle_ga4_error(exc, property_id)

    cache_service.set(cache_k, result, ttl=TTL_GA4_DATA)
    return result


async def get_traffic_sources(
    project_id: str,
    uid: str,
    property_id: str,
    start_date: str = "30daysAgo",
    end_date: str = "today",
) -> list[dict]:
    """
    Sessions by channel group.

    Returns: [{ source, medium, sessions, percentage }]
    Channel groups mapped to: Organic Search, Direct, Social,
    Referral, Email, Paid Search, Other.
    """
    from backend.services import cache_service
    from backend.services.cache_service import TTL_GA4_DATA

    cache_k = _cache_key(uid, property_id, "sources", f"{start_date}:{end_date}")
    cached = cache_service.get(cache_k)
    if cached is not None:
        return cached

    credentials = await _build_credentials(project_id, uid)

    import asyncio

    _CHANNEL_MAP = {
        "Organic Search": "Organic Search",
        "Direct": "Direct",
        "Organic Social": "Social",
        "Paid Social": "Social",
        "Referral": "Referral",
        "Email": "Email",
        "Paid Search": "Paid Search",
        "Display": "Paid Search",
    }

    def _run():
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )
        client = _ga4_client(credentials)
        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
            dimensions=[Dimension(name="sessionDefaultChannelGrouping")],
            metrics=[Metric(name="sessions")],
            order_bys=[OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True,
            )],
            limit=10,
        )
        resp = client.run_report(req)
        rows = [
            {
                "channel": row.dimension_values[0].value,
                "sessions": int(row.metric_values[0].value),
            }
            for row in resp.rows
        ]
        total = sum(r["sessions"] for r in rows) or 1
        return [
            {
                "source": _CHANNEL_MAP.get(r["channel"], "Other"),
                "medium": r["channel"],
                "sessions": r["sessions"],
                "percentage": round(r["sessions"] / total * 100, 1),
            }
            for r in rows
        ]

    try:
        result = await asyncio.to_thread(_run)
    except Exception as exc:
        _handle_ga4_error(exc, property_id)

    cache_service.set(cache_k, result, ttl=TTL_GA4_DATA)
    return result


async def get_conversion_events(
    project_id: str,
    uid: str,
    property_id: str,
) -> list[dict]:
    """
    Key conversion events.

    Returns: [{ event_name, count, value }]
    Includes known conversion event names or any event with count > 10.
    """
    from backend.services import cache_service
    from backend.services.cache_service import TTL_GA4_DATA

    cache_k = _cache_key(uid, property_id, "conversions", "30d")
    cached = cache_service.get(cache_k)
    if cached is not None:
        return cached

    credentials = await _build_credentials(project_id, uid)

    import asyncio

    _KNOWN_CONVERSIONS = {
        "purchase", "sign_up", "generate_lead", "submit_form",
        "contact", "begin_checkout", "add_payment_info",
    }

    def _run():
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )
        client = _ga4_client(credentials)
        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
            dimensions=[Dimension(name="eventName")],
            metrics=[
                Metric(name="eventCount"),
                Metric(name="eventValue"),
            ],
            order_bys=[OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True,
            )],
            limit=50,
        )
        resp = client.run_report(req)
        results = []
        for row in resp.rows:
            name = row.dimension_values[0].value
            count = int(row.metric_values[0].value)
            value = round(float(row.metric_values[1].value), 2)
            if name in _KNOWN_CONVERSIONS or count > 10:
                results.append({"event_name": name, "count": count, "value": value})
        return results

    try:
        result = await asyncio.to_thread(_run)
    except Exception as exc:
        _handle_ga4_error(exc, property_id)

    cache_service.set(cache_k, result, ttl=TTL_GA4_DATA)
    return result


# ---------------------------------------------------------------------------
# Cache invalidation
# ---------------------------------------------------------------------------

def clear_cache(uid: str, property_id: str) -> int:
    """Delete all cached GA4 responses for this uid + property."""
    from backend.services import cache_service
    prefix = f"ga4:{uid}:{property_id}:"
    return cache_service.delete_prefix(prefix)


# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------

def _handle_ga4_error(exc: Exception, property_id: str) -> None:
    """Convert GA4 API errors to typed HTTPExceptions."""
    from fastapi import HTTPException, status as http_status

    err_str = str(exc)
    logger.error("GA4 API error for property %s: %s", property_id, exc)

    if "403" in err_str or "PERMISSION_DENIED" in err_str:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="GA4 property access denied. Check property ID and account permissions.",
        )
    if "401" in err_str or "UNAUTHENTICATED" in err_str:
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="GA4 token expired. Please reconnect in Settings → Integrations.",
        )
    raise HTTPException(
        status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"GA4 data fetch failed: {exc}",
    )
