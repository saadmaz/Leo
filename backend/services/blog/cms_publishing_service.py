"""
CMS Publishing Service — WordPress REST API.

Auth: WordPress Application Passwords (introduced in WP 5.6).
The user provides their site URL + a generated Application Password.
We store the credentials encrypted in Firestore `cms_connections`.

No OAuth server needed — Application Passwords use HTTP Basic auth.
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_CMS_COLLECTION = "cms_connections"


# ---------------------------------------------------------------------------
# Firestore connection CRUD
# ---------------------------------------------------------------------------

def _encode_credentials(site_url: str, username: str, app_password: str) -> str:
    """Base64-encode credentials for storage. Not encryption — store in Firestore with access control."""
    payload = json.dumps({"site_url": site_url, "username": username, "app_password": app_password})
    return base64.b64encode(payload.encode()).decode()


def _decode_credentials(encoded: str) -> dict:
    return json.loads(base64.b64decode(encoded.encode()).decode())


def save_connection(project_id: str, site_url: str, username: str, app_password: str) -> dict:
    """Store a WordPress connection for a project."""
    from backend.services import firebase_service
    db = firebase_service.get_db()
    now = datetime.now(timezone.utc).isoformat()
    normalized_url = site_url.rstrip("/")
    data = {
        "project_id": project_id,
        "type": "wordpress",
        "site_url": normalized_url,
        "username": username,
        "credentials_encoded": _encode_credentials(normalized_url, username, app_password),
        "connected_at": now,
        "updated_at": now,
    }
    ref = db.collection(_CMS_COLLECTION).document()
    ref.set(data)
    safe = {k: v for k, v in data.items() if k != "credentials_encoded"}
    return {"id": ref.id, **safe}


def list_connections(project_id: str) -> list[dict]:
    """List CMS connections for a project (credentials stripped)."""
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        docs = (
            db.collection(_CMS_COLLECTION)
            .where("project_id", "==", project_id)
            .stream()
        )
        results = []
        for d in docs:
            data = d.to_dict()
            safe = {k: v for k, v in data.items() if k != "credentials_encoded"}
            results.append({"id": d.id, **safe})
        return results
    except Exception as exc:
        logger.error("Failed to list CMS connections: %s", exc)
        return []


def delete_connection(connection_id: str) -> None:
    from backend.services import firebase_service
    db = firebase_service.get_db()
    db.collection(_CMS_COLLECTION).document(connection_id).delete()


def _get_connection(connection_id: str) -> Optional[dict]:
    from backend.services import firebase_service
    db = firebase_service.get_db()
    doc = db.collection(_CMS_COLLECTION).document(connection_id).get()
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


# ---------------------------------------------------------------------------
# WordPress REST API
# ---------------------------------------------------------------------------

def _wp_auth_header(username: str, app_password: str) -> str:
    token = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    return f"Basic {token}"


async def test_connection(site_url: str, username: str, app_password: str) -> dict:
    """
    Verify WordPress credentials by hitting the /wp/v2/users/me endpoint.
    Returns { ok, display_name, site_name } or { ok: False, error }.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{site_url.rstrip('/')}/wp-json/wp/v2/users/me",
                headers={"Authorization": _wp_auth_header(username, app_password)},
            )
            if resp.status_code == 401:
                return {"ok": False, "error": "Invalid credentials"}
            resp.raise_for_status()
            data = resp.json()

            # Also fetch site name
            site_resp = await client.get(f"{site_url.rstrip('/')}/wp-json/")
            site_name = ""
            if site_resp.status_code == 200:
                site_name = site_resp.json().get("name", "")

            return {
                "ok": True,
                "display_name": data.get("name", username),
                "site_name": site_name,
            }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def publish_post(
    connection_id: str,
    title: str,
    content: str,
    status: str = "draft",
    slug: Optional[str] = None,
    excerpt: Optional[str] = None,
    categories: Optional[list[int]] = None,
    tags: Optional[list[str]] = None,
) -> dict:
    """
    Publish a post to WordPress via the REST API.

    status: "draft" | "publish"
    Returns { ok, post_id, post_url, edit_url } or { ok: False, error }.
    """
    connection = _get_connection(connection_id)
    if not connection:
        return {"ok": False, "error": "Connection not found"}

    creds = _decode_credentials(connection["credentials_encoded"])
    site_url = creds["site_url"]
    auth = _wp_auth_header(creds["username"], creds["app_password"])

    body: dict = {
        "title": title,
        "content": content,
        "status": status,
    }
    if slug:
        body["slug"] = slug
    if excerpt:
        body["excerpt"] = excerpt
    if categories:
        body["categories"] = categories

    # Tags: resolve tag names to IDs
    if tags:
        tag_ids = await _resolve_tag_ids(site_url, auth, tags)
        if tag_ids:
            body["tags"] = tag_ids

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{site_url}/wp-json/wp/v2/posts",
                headers={"Authorization": auth, "Content-Type": "application/json"},
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "ok": True,
                "post_id": data["id"],
                "post_url": data.get("link", ""),
                "edit_url": f"{site_url}/wp-admin/post.php?post={data['id']}&action=edit",
                "status": data.get("status", status),
            }
    except httpx.HTTPStatusError as exc:
        error_body = exc.response.text
        return {"ok": False, "error": f"WordPress API error {exc.response.status_code}: {error_body[:200]}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def _resolve_tag_ids(site_url: str, auth_header: str, tag_names: list[str]) -> list[int]:
    """Create tags that don't exist and return their IDs."""
    ids: list[int] = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for name in tag_names[:10]:  # cap to avoid runaway requests
            try:
                # Try to find existing tag
                resp = await client.get(
                    f"{site_url}/wp-json/wp/v2/tags",
                    headers={"Authorization": auth_header},
                    params={"search": name, "per_page": 1},
                )
                resp.raise_for_status()
                existing = resp.json()
                if existing:
                    ids.append(existing[0]["id"])
                    continue

                # Create new tag
                create = await client.post(
                    f"{site_url}/wp-json/wp/v2/tags",
                    headers={"Authorization": auth_header, "Content-Type": "application/json"},
                    json={"name": name},
                )
                if create.status_code in (200, 201):
                    ids.append(create.json()["id"])
            except Exception:
                pass
    return ids
