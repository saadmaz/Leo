"""
Ayrshare integration for Personal Brand publishing & scheduling.

Ayrshare manages one "profile" per social-media account set.  We use a
profile-per-project model so every user/project has isolated credentials.

Base URL: https://api.ayrshare.com/api/
Auth:     Authorization: Bearer <AYRSHARE_API_KEY>   (our master key)
          profileKey header for per-project operations (returned on profile create)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Optional

import httpx
from google.cloud import firestore

from config import settings
from services.firebase import db

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.ayrshare.com/api"

# Ayrshare platform slugs accepted by the POST /post endpoint
AYRSHARE_PLATFORMS = {
    "linkedin": "linkedin",
    "twitter": "twitter",
    "instagram": "instagram",
    "facebook": "facebook",
    "tiktok": "tiktok",
    "youtube": "youtube",
    "threads": "threads",
    "pinterest": "pinterest",
    "reddit": "reddit",
    "telegram": "telegram",
    "gmb": "gmb",
}


def _headers(profile_key: Optional[str] = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.AYRSHARE_API_KEY}",
        "Content-Type": "application/json",
    }
    if profile_key:
        headers["Profile-Key"] = profile_key
    return headers


# ---------------------------------------------------------------------------
# Profile management (one profile per personal-brand project)
# ---------------------------------------------------------------------------

async def get_or_create_profile(project_id: str) -> dict[str, Any]:
    """
    Returns the Ayrshare profile for this project.
    Creates one if it doesn't exist yet, persisting the profileKey to Firestore.
    """
    doc_ref = db.collection("personal_publishing_profiles").document(project_id)
    doc = await asyncio.to_thread(doc_ref.get)
    if doc.exists:
        return doc.to_dict()  # type: ignore[return-value]

    # Create a new profile
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_BASE_URL}/profiles/profile",
            headers=_headers(),
            json={"title": f"leo-project-{project_id}"},
        )
        resp.raise_for_status()
        data = resp.json()

    profile = {
        "profileKey": data.get("profileKey") or data.get("refId"),
        "title": data.get("title"),
        "createdAt": datetime.utcnow().isoformat(),
        "connectedPlatforms": [],
    }
    await asyncio.to_thread(doc_ref.set, profile)
    return profile


async def get_profile(project_id: str) -> Optional[dict[str, Any]]:
    doc = await asyncio.to_thread(
        db.collection("personal_publishing_profiles").document(project_id).get
    )
    return doc.to_dict() if doc.exists else None  # type: ignore[return-value]


async def get_profile_key(project_id: str) -> str:
    profile = await get_or_create_profile(project_id)
    key = profile.get("profileKey")
    if not key:
        raise ValueError(f"No profileKey for project {project_id}")
    return key


# ---------------------------------------------------------------------------
# Social link / connection URL
# ---------------------------------------------------------------------------

async def get_social_link_url(project_id: str, platform: str) -> dict[str, Any]:
    """
    Returns a short-lived URL the user visits to connect their social account.
    """
    profile_key = await get_profile_key(project_id)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_BASE_URL}/profiles/generateJWT",
            headers=_headers(profile_key),
            params={"platform": platform},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Connected platforms
# ---------------------------------------------------------------------------

async def get_connected_platforms(project_id: str) -> list[dict[str, Any]]:
    """
    Returns list of platforms currently connected to this project's profile.
    Also refreshes the cached list in Firestore.
    """
    profile_key = await get_profile_key(project_id)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_BASE_URL}/user",
            headers=_headers(profile_key),
        )
        resp.raise_for_status()
        data = resp.json()

    platforms: list[dict[str, Any]] = []
    social_accounts = data.get("socialAccounts", {})
    for platform, info in social_accounts.items():
        if isinstance(info, dict) and info.get("isActive"):
            platforms.append(
                {
                    "platform": platform,
                    "username": info.get("username") or info.get("name") or "",
                    "displayName": info.get("displayName") or info.get("name") or "",
                    "isActive": True,
                    "profileUrl": info.get("url") or "",
                }
            )

    # Refresh cache
    await asyncio.to_thread(
        db.collection("personal_publishing_profiles")
        .document(project_id)
        .update,
        {"connectedPlatforms": platforms},
    )
    return platforms


# ---------------------------------------------------------------------------
# Publishing
# ---------------------------------------------------------------------------

async def publish_now(
    project_id: str,
    post: str,
    platforms: list[str],
    media_urls: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Publishes immediately to the given platforms.
    Returns the Ayrshare response (includes per-platform status).
    """
    profile_key = await get_profile_key(project_id)
    payload: dict[str, Any] = {"post": post, "platforms": platforms}
    if media_urls:
        payload["mediaUrls"] = media_urls

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{_BASE_URL}/post",
            headers=_headers(profile_key),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    # Persist to history
    await _save_post_to_history(project_id, post, platforms, data, scheduled_at=None)
    return data


async def schedule_post(
    project_id: str,
    post: str,
    platforms: list[str],
    scheduled_date: str,  # ISO-8601 UTC, e.g. "2024-11-01T13:00:00Z"
    media_urls: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Schedules a post for a future UTC datetime.
    """
    profile_key = await get_profile_key(project_id)
    payload: dict[str, Any] = {
        "post": post,
        "platforms": platforms,
        "scheduleDate": scheduled_date,
    }
    if media_urls:
        payload["mediaUrls"] = media_urls

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{_BASE_URL}/post",
            headers=_headers(profile_key),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    await _save_post_to_history(
        project_id, post, platforms, data, scheduled_at=scheduled_date
    )
    return data


# ---------------------------------------------------------------------------
# Scheduled post management
# ---------------------------------------------------------------------------

async def list_scheduled_posts(project_id: str) -> list[dict[str, Any]]:
    """Returns all scheduled (pending) posts from Ayrshare."""
    profile_key = await get_profile_key(project_id)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_BASE_URL}/post",
            headers=_headers(profile_key),
        )
        resp.raise_for_status()
        data = resp.json()
    return data.get("posts", [])


async def cancel_scheduled_post(project_id: str, post_id: str) -> dict[str, Any]:
    """Cancels a pending scheduled post by its Ayrshare post ID."""
    profile_key = await get_profile_key(project_id)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.delete(
            f"{_BASE_URL}/post",
            headers=_headers(profile_key),
            params={"id": post_id},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Analytics for a post
# ---------------------------------------------------------------------------

async def get_post_analytics(project_id: str, post_id: str) -> dict[str, Any]:
    profile_key = await get_profile_key(project_id)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_BASE_URL}/analytics/post",
            headers=_headers(profile_key),
            params={"id": post_id},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _save_post_to_history(
    project_id: str,
    post: str,
    platforms: list[str],
    ayrshare_response: dict[str, Any],
    scheduled_at: Optional[str],
) -> None:
    try:
        history_ref = db.collection("personal_publishing_history").document()
        record = {
            "projectId": project_id,
            "post": post,
            "platforms": platforms,
            "scheduledAt": scheduled_at,
            "status": "scheduled" if scheduled_at else "published",
            "ayrsharePostId": ayrshare_response.get("id"),
            "ayrshareResponse": ayrshare_response,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        await asyncio.to_thread(history_ref.set, record)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to save publish history: %s", exc)
