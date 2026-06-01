"""
Google Search Console Service.

Handles OAuth2 flow and data retrieval for rank tracking.

Credentials: GOOGLE_SEARCH_CONSOLE_CLIENT_ID / _CLIENT_SECRET in settings.
Token storage: Firestore `user_integrations` collection under type=google_search_console.

The OAuth flow:
  1. GET /blog/gsc/auth-url?project_id=X  → returns redirect URL
  2. User authorises in browser
  3. Google redirects to /auth/gsc/callback?code=...&state=project_id:uid
  4. Tokens stored in Firestore
  5. Rank queries use stored refresh token
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

_GSC_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GSC_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GSC_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
_GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
_INTEGRATION_TYPE = "google_search_console"


# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------

def get_auth_url(state: str, redirect_uri: str) -> str:
    """Build the Google OAuth2 authorisation URL."""
    params = {
        "client_id": settings.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": _GSC_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{_GSC_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange an auth code for access + refresh tokens."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _GSC_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> str:
    """Use a refresh token to get a new access token. Returns the access token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _GSC_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Firestore token storage
# ---------------------------------------------------------------------------

def save_tokens(project_id: str, uid: str, tokens: dict) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        now = datetime.now(timezone.utc).isoformat()
        db.collection("user_integrations").document(f"{uid}_{_INTEGRATION_TYPE}_{project_id}").set({
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
        logger.error("Failed to save GSC tokens: %s", exc)


def get_tokens(project_id: str, uid: str) -> Optional[dict]:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        doc = db.collection("user_integrations").document(
            f"{uid}_{_INTEGRATION_TYPE}_{project_id}"
        ).get()
        if not doc.exists:
            return None
        return doc.to_dict()
    except Exception:
        return None


def delete_tokens(project_id: str, uid: str) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        db.collection("user_integrations").document(
            f"{uid}_{_INTEGRATION_TYPE}_{project_id}"
        ).delete()
    except Exception as exc:
        logger.warning("Failed to delete GSC tokens: %s", exc)


# ---------------------------------------------------------------------------
# GSC data retrieval
# ---------------------------------------------------------------------------

async def list_properties(project_id: str, uid: str) -> list[str]:
    """List the GSC properties (sites) the connected account has access to."""
    tokens = get_tokens(project_id, uid)
    if not tokens:
        return []
    try:
        access_token = await refresh_access_token(tokens["refresh_token"])
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/webmasters/v3/sites",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            sites = resp.json().get("siteEntry", [])
            return [s["siteUrl"] for s in sites]
    except Exception as exc:
        logger.error("Failed to list GSC properties: %s", exc)
        return []


async def get_position_data(
    project_id: str,
    uid: str,
    site_url: str,
    page_url: str,
    days_back: int = 90,
) -> list[dict]:
    """
    Fetch GSC position/click data for a specific page URL.

    Returns list of { date, position, clicks, impressions, ctr }
    """
    tokens = get_tokens(project_id, uid)
    if not tokens:
        return []

    from datetime import timedelta
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=days_back)

    try:
        access_token = await refresh_access_token(tokens["refresh_token"])
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://www.googleapis.com/webmasters/v3/sites/{site_url}/searchAnalytics/query",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "startDate": str(start_date),
                    "endDate": str(end_date),
                    "dimensions": ["date"],
                    "dimensionFilterGroups": [{
                        "filters": [{
                            "dimension": "page",
                            "operator": "equals",
                            "expression": page_url,
                        }]
                    }],
                    "rowLimit": 365,
                },
            )
            resp.raise_for_status()
            rows = resp.json().get("rows", [])
            return [
                {
                    "date": r["keys"][0],
                    "clicks": r.get("clicks", 0),
                    "impressions": r.get("impressions", 0),
                    "ctr": round(r.get("ctr", 0) * 100, 2),
                    "position": round(r.get("position", 0), 1),
                }
                for r in rows
            ]
    except Exception as exc:
        logger.error("GSC query failed for %s: %s", page_url, exc)
        return []
