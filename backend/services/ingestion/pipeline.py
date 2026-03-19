"""
Brand ingestion pipeline — orchestrates scraping → extraction → Firestore save.

Yields SSE-compatible step dicts that the route can stream to the client,
matching the animated progress overlay the frontend expects.
"""

import asyncio
import logging
from typing import AsyncIterator, Optional

from backend.config import settings
from backend.services.ingestion import firecrawl_client, apify_client, brand_extractor
from backend.services import firebase_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step helpers
# ---------------------------------------------------------------------------

def _step(label: str, status: str = "running", detail: str = "") -> dict:
    return {"type": "step", "label": label, "status": status, "detail": detail}


def _progress(pct: int) -> dict:
    return {"type": "progress", "pct": pct}


def _done(brand_core: dict) -> dict:
    return {"type": "done", "brandCore": brand_core}


def _error(message: str) -> dict:
    return {"type": "error", "message": message}


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def run(
    project_id: str,
    website_url: Optional[str],
    instagram_handle: Optional[str],
) -> AsyncIterator[dict]:
    """
    Async generator that streams progress steps and yields the final brand core.

    Usage:
        async for event in pipeline.run(project_id, website_url, instagram_handle):
            yield sse_format(event)
    """

    if not website_url and not instagram_handle:
        yield _error("Provide at least a website URL or Instagram handle.")
        return

    # Mark project as processing
    firebase_service.update_project(project_id, {"ingestionStatus": "processing"})

    scraped_data: list[dict] = []

    # -----------------------------------------------------------------------
    # Step 1 — Website scraping
    # -----------------------------------------------------------------------
    if website_url:
        yield _step("Connecting to website…")
        yield _progress(5)

        if not settings.FIRECRAWL_API_KEY:
            yield _step("Connecting to website…", "skipped", "FIRECRAWL_API_KEY not set")
        else:
            try:
                yield _step("Reading page content…", "running")
                yield _progress(15)
                result = await firecrawl_client.scrape_url(website_url, settings.FIRECRAWL_API_KEY)
                scraped_data.append(result)
                yield _step("Website content extracted", "done")
                yield _progress(30)
            except Exception as exc:
                logger.warning("Website scrape failed: %s", exc)
                yield _step("Website scraping failed", "error", str(exc)[:120])

    # -----------------------------------------------------------------------
    # Step 2 — Instagram scraping
    # -----------------------------------------------------------------------
    if instagram_handle:
        yield _step("Connecting to Instagram…", "running")
        yield _progress(35)

        if not settings.APIFY_API_KEY:
            yield _step("Connecting to Instagram…", "skipped", "APIFY_API_KEY not set")
        else:
            try:
                yield _step(f"Reading @{instagram_handle.lstrip('@')} posts…", "running")
                yield _progress(45)
                result = await apify_client.scrape_instagram(
                    instagram_handle, settings.APIFY_API_KEY, max_posts=30
                )
                scraped_data.append(result)
                yield _step("Instagram content extracted", "done")
                yield _progress(60)
            except Exception as exc:
                logger.warning("Instagram scrape failed: %s", exc)
                yield _step("Instagram scraping failed", "error", str(exc)[:120])

    # -----------------------------------------------------------------------
    # Bail if nothing was scraped
    # -----------------------------------------------------------------------
    if not scraped_data:
        firebase_service.update_project(project_id, {"ingestionStatus": "error"})
        yield _error("No content could be scraped. Check your URL/handle and API keys.")
        return

    # -----------------------------------------------------------------------
    # Step 3 — Brand Core extraction via Claude
    # -----------------------------------------------------------------------
    yield _step("Analysing brand tone & voice…", "running")
    yield _progress(65)

    if not settings.ANTHROPIC_API_KEY:
        firebase_service.update_project(project_id, {"ingestionStatus": "error"})
        yield _error("ANTHROPIC_API_KEY not set — cannot extract Brand Core.")
        return

    try:
        yield _step("Detecting colour palette & visual identity…", "running")
        yield _progress(75)

        brand_core = await brand_extractor.extract_brand_core(scraped_data, settings.ANTHROPIC_API_KEY)

        yield _step("Identifying content themes…", "running")
        yield _progress(85)

        yield _step("Building Brand Core…", "running")
        yield _progress(92)

    except Exception as exc:
        logger.error("Brand extraction failed: %s", exc)
        firebase_service.update_project(project_id, {"ingestionStatus": "error"})
        yield _error(f"Brand Core extraction failed: {exc}")
        return

    # -----------------------------------------------------------------------
    # Step 4 — Persist to Firestore
    # -----------------------------------------------------------------------
    try:
        firebase_service.update_project(project_id, {
            "brandCore": brand_core,
            "ingestionStatus": "complete",
        })
        yield _step("Brand Core saved", "done")
        yield _progress(100)
    except Exception as exc:
        logger.error("Firestore save failed: %s", exc)
        yield _error(f"Failed to save Brand Core: {exc}")
        return

    yield _done(brand_core)
