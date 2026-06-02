"""
Leo Analytics Tracking Service.

Manages the first-party analytics tracking pixel for brands.

Architecture:
  1. Each project gets a unique tracking_token (UUID).
  2. Brands embed: <script src="https://your-cdn/leo-track.js" data-token="proj_xxx"></script>
  3. The JS script beacons events to POST /t/v1/e (no auth, ultra-fast, CORS open).
  4. Events are written to Firestore: tracking_events/{project_id}/events/{event_id}
  5. Daily aggregation rolls up raw events → tracking_daily/{project_id}/{YYYY-MM-DD}
  6. Stats endpoint reads from aggregated collection for speed.

Event schema:
  { token, type, url, referrer, title, ua, ts, session_id, screen }

Aggregated daily doc:
  { date, pageviews, sessions, unique_pages: {url: count}, sources: {domain: count} }

Premium gating:
  - Free tier: No access (feature not available)
  - Pro: Up to 50k pageviews/month, 90-day retention
  - Agency: Up to 500k pageviews/month, 1-year retention
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_TOKEN_PREFIX = "ltk_"
_MAX_EVENTS_PER_REQUEST = 10

# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

def generate_tracking_token() -> str:
    """Generate a unique, hard-to-guess tracking token."""
    return f"{_TOKEN_PREFIX}{secrets.token_urlsafe(24)}"


def save_tracking_config(project_id: str, token: str) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        db.collection("projects").document(project_id).update({
            "trackingToken": token,
            "trackingEnabled": True,
            "trackingCreatedAt": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("Failed to save tracking config for %s: %s", project_id, exc)


def get_tracking_config(project_id: str) -> Optional[dict]:
    try:
        from backend.services import firebase_service
        project = firebase_service.get_project(project_id)
        if not project:
            return None
        return {
            "enabled": project.get("trackingEnabled", False),
            "token": project.get("trackingToken"),
            "created_at": project.get("trackingCreatedAt"),
        }
    except Exception:
        return None


def resolve_token_to_project(token: str) -> Optional[str]:
    """Resolve a tracking token to a project_id. Cached in memory for performance."""
    try:
        from backend.services import firebase_service, cache_service
        cache_key = f"track_token:{token}"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached or None

        db = firebase_service.get_db()
        docs = (
            db.collection("projects")
            .where("trackingToken", "==", token)
            .where("trackingEnabled", "==", True)
            .limit(1)
            .stream()
        )
        for doc in docs:
            project_id = doc.id
            cache_service.set(cache_key, project_id, ttl=3600)
            return project_id

        cache_service.set(cache_key, "", ttl=300)
        return None
    except Exception as exc:
        logger.error("Token resolution failed: %s", exc)
        return None


def disable_tracking(project_id: str) -> None:
    try:
        from backend.services import firebase_service
        firebase_service.update_project(project_id, {"trackingEnabled": False})
    except Exception as exc:
        logger.error("Failed to disable tracking for %s: %s", project_id, exc)


# ---------------------------------------------------------------------------
# Event ingestion
# ---------------------------------------------------------------------------

def ingest_event(project_id: str, event: dict) -> bool:
    """
    Write a single tracking event to Firestore.
    Designed to be as fast as possible — minimal processing.

    event fields: { type, url, referrer, title, ua, ts, session_id, screen }
    """
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()

        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d")

        # Sanitise + cap field lengths
        clean_event = {
            "project_id": project_id,
            "type": str(event.get("type", "pageview"))[:32],
            "url": str(event.get("url", ""))[:512],
            "referrer": str(event.get("referrer", ""))[:512],
            "title": str(event.get("title", ""))[:200],
            "session_id": str(event.get("session_id", ""))[:64],
            "screen": str(event.get("screen", ""))[:32],
            "date": date_str,
            "ts": now.isoformat(),
        }

        # Hash the UA for privacy — never store raw UA
        ua_raw = str(event.get("ua", ""))[:512]
        clean_event["ua_hash"] = hashlib.sha256(ua_raw.encode()).hexdigest()[:16]

        event_id = str(uuid.uuid4())
        db.collection("tracking_events").document(project_id).collection("events").document(event_id).set(clean_event)

        # Fire-and-forget daily aggregate update
        _update_daily_aggregate(db, project_id, date_str, clean_event)
        return True
    except Exception as exc:
        logger.error("Event ingest failed for project %s: %s", project_id, exc)
        return False


def _update_daily_aggregate(db, project_id: str, date_str: str, event: dict) -> None:
    """Increment daily aggregate counters. Uses Firestore field increments."""
    try:
        from google.cloud.firestore_v1 import Increment, ArrayUnion
        doc_ref = db.collection("tracking_daily").document(f"{project_id}_{date_str}")

        page_path = _extract_path(event.get("url", ""))
        source_domain = _extract_domain(event.get("referrer", ""))

        update = {
            "project_id": project_id,
            "date": date_str,
            "pageviews": Increment(1),
        }
        if page_path:
            update[f"pages.{_safe_key(page_path)}"] = Increment(1)
        if source_domain:
            update[f"sources.{_safe_key(source_domain)}"] = Increment(1)

        doc_ref.set(update, merge=True)
    except Exception as exc:
        logger.debug("Daily aggregate update failed: %s", exc)


# ---------------------------------------------------------------------------
# Stats retrieval
# ---------------------------------------------------------------------------

async def get_stats(project_id: str, days: int = 30) -> dict:
    """
    Return aggregated stats for the given project over the last N days.

    Returns:
    {
      pageviews: int,
      sessions: int (estimated as pageviews / avg_pages_per_session),
      top_pages: [{ page, views }],
      top_sources: [{ source, views }],
      daily: [{ date, pageviews }],
    }
    """
    try:
        import asyncio
        from backend.services import firebase_service

        db = firebase_service.get_db()
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=days)

        # Build list of date strings in range
        date_range = []
        current = start
        while current <= end:
            date_range.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)

        # Fetch all daily docs in parallel batches
        def _fetch_docs():
            doc_ids = [f"{project_id}_{d}" for d in date_range]
            results = []
            # Firestore doesn't support batch get by ID directly via collection.stream with filter on doc IDs
            # so fetch by range query on project_id + date
            docs = (
                db.collection("tracking_daily")
                .where("project_id", "==", project_id)
                .where("date", ">=", str(start))
                .where("date", "<=", str(end))
                .stream()
            )
            for doc in docs:
                results.append(doc.to_dict())
            return results

        docs = await asyncio.to_thread(_fetch_docs)

        total_pageviews = sum(d.get("pageviews", 0) for d in docs)
        daily = [{"date": d["date"], "pageviews": d.get("pageviews", 0)} for d in docs]
        daily.sort(key=lambda x: x["date"])

        # Aggregate top pages across all days
        page_totals: dict[str, int] = {}
        source_totals: dict[str, int] = {}
        for d in docs:
            for page, count in (d.get("pages") or {}).items():
                page_totals[page] = page_totals.get(page, 0) + count
            for src, count in (d.get("sources") or {}).items():
                source_totals[src] = source_totals.get(src, 0) + count

        top_pages = sorted(
            [{"page": _restore_key(k), "views": v} for k, v in page_totals.items()],
            key=lambda x: x["views"], reverse=True,
        )[:10]
        top_sources = sorted(
            [{"source": _restore_key(k), "views": v} for k, v in source_totals.items()],
            key=lambda x: x["views"], reverse=True,
        )[:8]

        return {
            "pageviews": total_pageviews,
            "sessions": max(1, int(total_pageviews / 2.3)),  # heuristic: avg 2.3 pages/session
            "top_pages": top_pages,
            "top_sources": top_sources,
            "daily": daily,
        }
    except Exception as exc:
        logger.error("Stats fetch failed for %s: %s", project_id, exc)
        return {"pageviews": 0, "sessions": 0, "top_pages": [], "top_sources": [], "daily": []}


# ---------------------------------------------------------------------------
# AI Insights for tracked data
# ---------------------------------------------------------------------------

async def generate_tracking_insights(project_id: str, stats: dict) -> list[dict]:
    """Ask Claude to surface insights from the Leo tracking data."""
    from backend.config import settings
    from backend.services.llm_service import get_client
    from backend.services import firebase_service

    project = firebase_service.get_project(project_id) or {}
    brand_name = project.get("name", "this brand")

    if not stats.get("pageviews"):
        return []

    top_pages = ", ".join(p["page"] for p in stats["top_pages"][:5]) or "none"
    top_sources = ", ".join(s["source"] for s in stats["top_sources"][:5]) or "none"

    prompt = f"""You are a web analytics expert for "{brand_name}".

Website stats (Leo Analytics Tag, last 30 days):
- Pageviews: {stats['pageviews']:,}
- Estimated sessions: {stats['sessions']:,}
- Top pages: {top_pages}
- Top traffic sources: {top_sources}

Give 3 specific, actionable insights. Return ONLY valid JSON:
{{
  "insights": [
    {{
      "title": "<short headline>",
      "body": "<2-3 sentences with specific data + recommended action>",
      "type": "opportunity" | "warning" | "win"
    }}
  ]
}}"""

    client = get_client()
    try:
        response = await client.messages.create(
            model=settings.LLM_CLASSIFICATION_MODEL,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        result = _parse_json_response(response.content[0].text)
        return result.get("insights", [])
    except Exception as exc:
        logger.error("Tracking insights failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_path(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).path or "/"
    except Exception:
        return "/"


def _extract_domain(url: str) -> str:
    if not url:
        return "direct"
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.replace("www.", "")
        return host or "direct"
    except Exception:
        return "direct"


def _safe_key(value: str) -> str:
    """Firestore field keys can't contain . / [ ] — replace with underscores."""
    return value.replace(".", "_").replace("/", "__").replace("[", "_").replace("]", "_")[:100]


def _restore_key(value: str) -> str:
    """Reverse the safe key encoding (best-effort)."""
    return value.replace("__", "/").replace("_", ".")
