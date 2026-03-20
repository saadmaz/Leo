"""
Brand ingestion pipeline — orchestrates scraping → extraction → Firestore save.

Yields SSE-compatible event dicts that the ingestion route can stream directly
to the client. The frontend's animated progress overlay reads these events to
show live step status and a progress bar.

Event shapes:
  { "type": "step",     "label": "...", "status": "running|done|error|skipped", "detail": "..." }
  { "type": "progress", "pct": 0-100 }
  { "type": "done",     "brandCore": { ... } }
  { "type": "error",    "message": "..." }
"""

import logging
from typing import AsyncIterator, Optional
from urllib.parse import urlparse

from backend.config import settings
from backend.services.ingestion import firecrawl_client, apify_client, brand_extractor
from backend.services import firebase_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Event constructors — keep consistent shape across all yield sites
# ---------------------------------------------------------------------------

def _step(label: str, status: str = "running", detail: str = "") -> dict:
    """Emit a labelled step with a status badge shown in the progress overlay."""
    return {"type": "step", "label": label, "status": status, "detail": detail}


def _progress(pct: int) -> dict:
    """Emit a progress percentage (0–100) for the progress bar."""
    return {"type": "progress", "pct": max(0, min(100, pct))}


def _done(brand_core: dict) -> dict:
    """Emit the final success event with the extracted Brand Core."""
    return {"type": "done", "brandCore": brand_core}


def _error(message: str) -> dict:
    """Emit a terminal error event. The pipeline stops after yielding this."""
    return {"type": "error", "message": message}


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def _validate_url(url: str) -> str:
    """
    Ensure the URL has an http or https scheme and a non-empty host.
    Returns the (possibly normalised) URL string.
    Raises ValueError with a user-friendly message on failure.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(
            f"Invalid URL scheme {parsed.scheme!r} in {url!r}. "
            "Only http:// and https:// are supported."
        )
    if not parsed.netloc:
        raise ValueError(f"URL has no host: {url!r}")
    return url


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def run(
    project_id: str,
    website_url: Optional[str],
    instagram_handle: Optional[str],
) -> AsyncIterator[dict]:
    """
    Async generator that drives the four-step ingestion pipeline:
      1. Website scraping via Firecrawl
      2. Instagram scraping via Apify
      3. Brand Core extraction via Claude
      4. Persist to Firestore

    At least one of website_url or instagram_handle must be non-None.
    The generator always terminates; callers must handle both 'done' and
    'error' terminal events.

    Usage:
        async for event in pipeline.run(project_id, website_url, handle):
            yield sse_format(event)
    """
    if not website_url and not instagram_handle:
        yield _error("Provide at least a website URL or Instagram handle.")
        return

    # --- Input validation ---
    if website_url:
        try:
            website_url = _validate_url(website_url)
        except ValueError as exc:
            yield _error(str(exc))
            return

    # instagram_handle normalisation is already done in IngestRequest.normalise_handle;
    # strip @ here as a defensive measure in case the pipeline is called directly.
    if instagram_handle:
        instagram_handle = instagram_handle.lstrip("@").strip()
        if not instagram_handle:
            yield _error("Instagram handle cannot be empty after normalisation.")
            return

    # Mark the project as processing so the UI can show a spinner.
    firebase_service.update_project(project_id, {"ingestionStatus": "processing"})

    scraped_data: list[dict] = []

    # -----------------------------------------------------------------------
    # Step 1 — Website scraping
    # -----------------------------------------------------------------------
    if website_url:
        yield _step("Connecting to website…")
        yield _progress(5)

        if not settings.FIRECRAWL_API_KEY:
            yield _step("Connecting to website…", "skipped", "FIRECRAWL_API_KEY not configured")
        else:
            try:
                yield _step("Reading page content…", "running")
                yield _progress(15)
                result = await firecrawl_client.scrape_url(website_url, settings.FIRECRAWL_API_KEY)
                scraped_data.append(result)
                yield _step("Website content extracted", "done")
                yield _progress(30)
            except Exception as exc:
                logger.warning("Website scrape failed for %s: %s", website_url, exc)
                # Non-fatal — continue to Instagram step if available.
                yield _step("Website scraping failed", "error", str(exc)[:120])

    # -----------------------------------------------------------------------
    # Step 2 — Instagram scraping
    # -----------------------------------------------------------------------
    if instagram_handle:
        yield _step("Connecting to Instagram…", "running")
        yield _progress(35)

        if not settings.APIFY_API_KEY:
            yield _step("Connecting to Instagram…", "skipped", "APIFY_API_KEY not configured")
        else:
            try:
                yield _step(f"Reading @{instagram_handle} posts…", "running")
                yield _progress(45)
                result = await apify_client.scrape_instagram(
                    instagram_handle, settings.APIFY_API_KEY, max_posts=30
                )
                scraped_data.append(result)
                yield _step("Instagram content extracted", "done")
                yield _progress(60)
            except Exception as exc:
                logger.warning("Instagram scrape failed for @%s: %s", instagram_handle, exc)
                # Non-fatal — continue to extraction if website data was collected.
                yield _step("Instagram scraping failed", "error", str(exc)[:120])

    # -----------------------------------------------------------------------
    # Guard — bail if neither source produced data
    # -----------------------------------------------------------------------
    if not scraped_data:
        firebase_service.update_project(project_id, {"ingestionStatus": "error"})
        yield _error(
            "No content could be scraped. "
            "Check your URL/handle and ensure FIRECRAWL_API_KEY / APIFY_API_KEY are set."
        )
        return

    # -----------------------------------------------------------------------
    # Step 3 — Brand Core extraction via Claude
    # -----------------------------------------------------------------------
    if not settings.ANTHROPIC_API_KEY:
        firebase_service.update_project(project_id, {"ingestionStatus": "error"})
        yield _error("ANTHROPIC_API_KEY is not set — cannot extract Brand Core.")
        return

    yield _step("Analysing brand tone & voice…", "running")
    yield _progress(65)

    try:
        yield _step("Detecting colour palette & visual identity…", "running")
        yield _progress(75)

        brand_core = await brand_extractor.extract_brand_core(scraped_data, settings.ANTHROPIC_API_KEY)

        yield _step("Identifying content themes…", "running")
        yield _progress(85)

        yield _step("Building Brand Core…", "running")
        yield _progress(92)

    except Exception as exc:
        logger.error("Brand extraction failed for project %s: %s", project_id, exc)
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
        logger.error("Firestore save failed for project %s: %s", project_id, exc)
        yield _error(f"Failed to save Brand Core: {exc}")
        return

    yield _done(brand_core)
