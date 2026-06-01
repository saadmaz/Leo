"""
Blog Rank Tracker Service.

Stores and retrieves rank history snapshots for published blog posts.
Supports two data sources:
  - Google Search Console (free, first-party, requires OAuth)
  - DataForSEO SERP tracking (paid, works without GSC verification)

Rank history is stored in Firestore `blog_rank_history` collection.
Each document = one tracked post. Snapshots array is appended weekly.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

_RANK_COLLECTION = "blog_rank_history"


# ---------------------------------------------------------------------------
# Firestore CRUD
# ---------------------------------------------------------------------------

def get_rank_record(project_id: str, post_url: str) -> Optional[dict]:
    """Get the rank history record for a specific URL."""
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        docs = (
            db.collection(_RANK_COLLECTION)
            .where("project_id", "==", project_id)
            .where("post_url", "==", post_url)
            .limit(1)
            .stream()
        )
        results = list(docs)
        if not results:
            return None
        doc = results[0]
        return {"id": doc.id, **doc.to_dict()}
    except Exception as exc:
        logger.error("Failed to get rank record: %s", exc)
        return None


def list_rank_records(project_id: str) -> list[dict]:
    """List all rank-tracked posts for a project."""
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        docs = (
            db.collection(_RANK_COLLECTION)
            .where("project_id", "==", project_id)
            .stream()
        )
        return [{"id": d.id, **d.to_dict()} for d in docs]
    except Exception as exc:
        logger.error("Failed to list rank records: %s", exc)
        return []


def upsert_rank_record(project_id: str, post_url: str, target_keyword: str, data_source: str) -> dict:
    """Create or update a rank tracking record for a post."""
    from backend.services import firebase_service
    db = firebase_service.get_db()
    existing = get_rank_record(project_id, post_url)
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        db.collection(_RANK_COLLECTION).document(existing["id"]).update({
            "updated_at": now,
            "target_keyword": target_keyword,
            "data_source": data_source,
        })
        return existing

    data = {
        "project_id": project_id,
        "post_url": post_url,
        "target_keyword": target_keyword,
        "data_source": data_source,
        "snapshots": [],
        "created_at": now,
        "updated_at": now,
    }
    ref = db.collection(_RANK_COLLECTION).document()
    ref.set(data)
    return {"id": ref.id, **data}


def append_snapshot(record_id: str, snapshot: dict) -> None:
    """Add a snapshot to an existing rank record."""
    try:
        from backend.services import firebase_service
        from google.cloud.firestore_v1 import ArrayUnion
        db = firebase_service.get_db()
        db.collection(_RANK_COLLECTION).document(record_id).update({
            "snapshots": ArrayUnion([snapshot]),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("Failed to append rank snapshot: %s", exc)


# ---------------------------------------------------------------------------
# DataForSEO rank check
# ---------------------------------------------------------------------------

async def check_rank_dataforseo(keyword: str, target_url: str, location_code: int = 2840) -> Optional[dict]:
    """
    Check current Google rank for a keyword+URL pair via DataForSEO.
    Returns { position, url } or None if not found in top 100.
    """
    if not (settings.DATAFORSEO_LOGIN and settings.DATAFORSEO_PASSWORD):
        return None

    creds = f"{settings.DATAFORSEO_LOGIN}:{settings.DATAFORSEO_PASSWORD}"
    auth = "Basic " + base64.b64encode(creds.encode()).decode()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
                headers={"Authorization": auth, "Content-Type": "application/json"},
                json=[{
                    "keyword": keyword,
                    "location_code": location_code,
                    "language_code": "en",
                    "depth": 100,
                }],
            )
            resp.raise_for_status()
            items = (
                resp.json().get("tasks", [{}])[0]
                .get("result", [{}])[0]
                .get("items", [])
            )

        from urllib.parse import urlparse
        target_domain = urlparse(target_url).netloc.lower()

        for item in items:
            if item.get("type") != "organic":
                continue
            item_url = item.get("url", "")
            item_domain = urlparse(item_url).netloc.lower()
            if item_domain == target_domain or item_url == target_url:
                return {
                    "position": item.get("rank_absolute"),
                    "url": item_url,
                }
        return None
    except Exception as exc:
        logger.warning("DataForSEO rank check failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Snapshot runner
# ---------------------------------------------------------------------------

async def take_snapshot(
    project_id: str,
    post_url: str,
    target_keyword: str,
    uid: Optional[str] = None,
    gsc_site_url: Optional[str] = None,
) -> dict:
    """
    Take a rank snapshot for a post. Tries GSC first, falls back to DataForSEO.
    Appends the snapshot to Firestore and returns it.
    """
    now = datetime.now(timezone.utc)
    snapshot: dict = {
        "date": now.date().isoformat(),
        "timestamp": now.isoformat(),
        "position": None,
        "clicks": None,
        "impressions": None,
        "ctr": None,
        "source": "unknown",
    }

    # Try GSC first (free, first-party)
    if uid and gsc_site_url:
        try:
            from backend.services.blog.gsc_service import get_position_data
            gsc_data = await get_position_data(project_id, uid, gsc_site_url, post_url, days_back=7)
            if gsc_data:
                latest = max(gsc_data, key=lambda x: x["date"])
                snapshot.update({
                    "position": latest["position"],
                    "clicks": latest["clicks"],
                    "impressions": latest["impressions"],
                    "ctr": latest["ctr"],
                    "source": "gsc",
                })
        except Exception as exc:
            logger.warning("GSC snapshot failed, falling back to DataForSEO: %s", exc)

    # Fall back to DataForSEO
    if snapshot["position"] is None:
        dfs_result = await check_rank_dataforseo(target_keyword, post_url)
        if dfs_result:
            snapshot.update({
                "position": dfs_result["position"],
                "source": "dataforseo",
            })

    # Store
    record = upsert_rank_record(project_id, post_url, target_keyword, snapshot["source"])
    append_snapshot(record["id"], snapshot)

    return snapshot
