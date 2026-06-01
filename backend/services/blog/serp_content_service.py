"""
SERP Content Analysis Service.

For a given keyword, fetches the top 10 ranking URLs via DataForSEO,
scrapes each with Firecrawl, then uses Claude to synthesise:
  - Consensus H2 structure
  - NLP terms present in 7+ of the top 10
  - Average word count
  - One clear content gap

Results are cached in Firestore `blog_serp_cache` for 7 days to control
DataForSEO and Firecrawl costs.

IMPORTANT: This service deliberately routes through Firecrawl, NOT Exa.
Exa has a 100-call/day hard limit; SERP analysis needs 10 scrapes per
keyword and would exhaust that quota at any real usage volume.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

import httpx

from backend.config import settings
from backend.services.llm_service import get_client

logger = logging.getLogger(__name__)

_SERP_CACHE_COLLECTION = "blog_serp_cache"
_CACHE_TTL_DAYS = 7


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# DataForSEO helpers
# ---------------------------------------------------------------------------

def _dfs_auth() -> str:
    creds = f"{settings.DATAFORSEO_LOGIN}:{settings.DATAFORSEO_PASSWORD}"
    return "Basic " + base64.b64encode(creds.encode()).decode()


async def _get_serp_urls(keyword: str, location_code: int = 2840) -> list[str]:
    """Return the top 10 organic result URLs for a keyword from DataForSEO."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            headers={"Authorization": _dfs_auth(), "Content-Type": "application/json"},
            json=[{
                "keyword": keyword,
                "location_code": location_code,
                "language_code": "en",
                "os": "windows",
                "depth": 10,
            }],
        )
        resp.raise_for_status()
        data = resp.json()

    items = (
        data.get("tasks", [{}])[0]
        .get("result", [{}])[0]
        .get("items", [])
    )
    return [
        item["url"]
        for item in items
        if item.get("type") == "organic" and item.get("url")
    ][:10]


# ---------------------------------------------------------------------------
# Firecrawl helpers
# ---------------------------------------------------------------------------

async def _scrape_url_for_serp(url: str) -> Optional[dict]:
    """
    Scrape a URL and return a lightweight summary dict:
    { url, title, markdown, word_count }

    Uses a simpler extraction prompt than brand ingestion — we just want
    the content structure, not brand data.
    """
    if not settings.FIRECRAWL_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={
                    "Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "url": url,
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                },
            )
            resp.raise_for_status()
            result = resp.json().get("data", {})

        markdown = result.get("markdown", "")
        title = result.get("metadata", {}).get("title", "")
        word_count = len(markdown.split())
        return {"url": url, "title": title, "markdown": markdown, "word_count": word_count}
    except Exception as exc:
        logger.warning("Firecrawl scrape failed for %s: %s", url, exc)
        return None


def _extract_h2s(markdown: str) -> list[str]:
    """Extract H2 headings from markdown."""
    return [
        line.lstrip("# ").strip()
        for line in markdown.splitlines()
        if re.match(r"^#{2}\s", line)
    ]


def _extract_nlp_terms(markdown: str, top_n: int = 30) -> list[str]:
    """
    Simple frequency-based NLP term extraction.
    Returns top N 2-3 word noun phrases by frequency.
    """
    text = re.sub(r"[^a-zA-Z\s]", " ", markdown.lower())
    words = text.split()
    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "that", "this", "these", "those",
        "it", "its", "you", "your", "we", "our", "they", "their", "how",
        "what", "when", "where", "which", "who", "as", "if", "then", "than",
        "so", "not", "no", "can", "more", "also", "just", "about", "up", "into",
    }
    freq: dict[str, int] = {}
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if words[i] not in stopwords and words[i+1] not in stopwords:
            freq[bigram] = freq.get(bigram, 0) + 1
    sorted_terms = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [term for term, count in sorted_terms if count >= 2][:top_n]


# ---------------------------------------------------------------------------
# Firestore cache
# ---------------------------------------------------------------------------

def _cache_key(project_id: str, keyword: str) -> str:
    normalized = re.sub(r"\s+", " ", keyword.lower().strip())
    raw = f"{project_id}:{normalized}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _get_cached(project_id: str, keyword: str) -> Optional[dict]:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        key = _cache_key(project_id, keyword)
        doc = db.collection(_SERP_CACHE_COLLECTION).document(key).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        expires_at = data.get("expires_at")
        if expires_at and datetime.now(timezone.utc).isoformat() > expires_at:
            return None
        return data.get("analysis")
    except Exception:
        return None


def _set_cached(project_id: str, keyword: str, analysis: dict) -> None:
    try:
        from backend.services import firebase_service
        db = firebase_service.get_db()
        key = _cache_key(project_id, keyword)
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=_CACHE_TTL_DAYS)
        ).isoformat()
        db.collection(_SERP_CACHE_COLLECTION).document(key).set({
            "project_id": project_id,
            "keyword": keyword,
            "analysis": analysis,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning("Failed to cache SERP analysis: %s", exc)


# ---------------------------------------------------------------------------
# Main stream
# ---------------------------------------------------------------------------

async def stream_serp_analysis(
    project_id: str,
    keyword: str,
    location_code: int = 2840,
) -> AsyncGenerator[str, None]:
    """
    Stream SERP content analysis for a keyword.

    SSE events:
      { type: "step",     label, status }
      { type: "progress", message }
      { type: "done",     analysis }
      { type: "error",    error }
    """
    # Cache check
    cached = _get_cached(project_id, keyword)
    if cached:
        yield _sse({"type": "step", "label": "Loaded from cache (7-day TTL)", "status": "done"})
        yield _sse({"type": "done", "analysis": cached})
        yield "data: [DONE]\n\n"
        return

    # Step 1: DataForSEO SERP fetch
    yield _sse({"type": "step", "label": f'Fetching top 10 results for "{keyword}"', "status": "running"})

    urls: list[str] = []
    use_dataforseo = bool(settings.DATAFORSEO_LOGIN and settings.DATAFORSEO_PASSWORD)

    if use_dataforseo:
        try:
            urls = await _get_serp_urls(keyword, location_code)
            yield _sse({"type": "step", "label": f"Found {len(urls)} ranking pages", "status": "done"})
        except Exception as exc:
            logger.warning("DataForSEO SERP fetch failed: %s", exc)
            yield _sse({"type": "step", "label": "DataForSEO unavailable — analysis degraded", "status": "skipped"})
    else:
        yield _sse({"type": "step", "label": "DataForSEO not configured — Claude-only analysis", "status": "skipped"})

    # Step 2: Firecrawl scraping
    scraped: list[dict] = []
    if urls and settings.FIRECRAWL_API_KEY:
        yield _sse({"type": "step", "label": f"Scraping {len(urls)} pages for content structure", "status": "running"})

        # Scrape concurrently, cap at 5 simultaneous to avoid overloading Firecrawl
        semaphore = asyncio.Semaphore(5)

        async def _bounded_scrape(url: str) -> Optional[dict]:
            async with semaphore:
                result = await _scrape_url_for_serp(url)
                if result:
                    yield_msg = result.get("title") or url
                    return result
                return None

        tasks = [_bounded_scrape(u) for u in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        scraped = [r for r in results if isinstance(r, dict) and r is not None]
        yield _sse({"type": "step", "label": f"Scraped {len(scraped)}/{len(urls)} pages successfully", "status": "done"})
    elif urls:
        yield _sse({"type": "step", "label": "Firecrawl not configured — skipping content scrape", "status": "skipped"})

    # Step 3: Client-side summarisation before Claude sees it
    # Extract H2s and NLP terms per page to reduce token cost
    page_summaries: list[dict] = []
    h2_frequency: dict[str, int] = {}
    all_nlp_terms: list[list[str]] = []

    for page in scraped:
        markdown = page.get("markdown", "")
        h2s = _extract_h2s(markdown)
        nlp_terms = _extract_nlp_terms(markdown)
        word_count = page.get("word_count", 0)

        for h2 in h2s:
            normalized = h2.lower().strip()
            h2_frequency[normalized] = h2_frequency.get(normalized, 0) + 1

        all_nlp_terms.append(nlp_terms)
        page_summaries.append({
            "url": page["url"],
            "title": page.get("title", ""),
            "word_count": word_count,
            "h2s": h2s[:8],  # top 8 per page
            "nlp_terms": nlp_terms[:15],  # top 15 per page
        })

    # NLP terms appearing in 7+ pages
    term_page_count: dict[str, int] = {}
    for page_terms in all_nlp_terms:
        for term in set(page_terms):
            term_page_count[term] = term_page_count.get(term, 0) + 1
    consensus_nlp = [t for t, c in term_page_count.items() if c >= min(7, max(1, len(scraped) - 2))]

    avg_word_count = int(sum(p["word_count"] for p in page_summaries) / len(page_summaries)) if page_summaries else 1200

    # Step 4: Claude synthesis
    yield _sse({"type": "step", "label": "Synthesising content patterns with Claude", "status": "running"})

    summaries_str = json.dumps(page_summaries, indent=2) if page_summaries else (
        f"No pages scraped. Keyword: {keyword}. Generate analysis from SEO knowledge."
    )

    client = get_client()
    prompt = f"""You are an SEO content strategist. Analyse these SERP summaries for the keyword "{keyword}" and produce a structured content gap analysis.

PAGE SUMMARIES (title, word count, H2 headings, common NLP terms):
{summaries_str[:8000]}

PRE-COMPUTED DATA:
- Average word count across pages: {avg_word_count}
- NLP terms in 7+ pages: {consensus_nlp[:20]}
- H2 frequency map (how often each H2 appears): {dict(sorted(h2_frequency.items(), key=lambda x: x[1], reverse=True)[:20])}

Return ONLY valid JSON:
{{
  "keyword": "{keyword}",
  "avg_word_count": {avg_word_count},
  "recommended_word_count": <round avg to nearest 250, add 10% for coverage advantage>,
  "consensus_h2s": ["<H2 text>"],
  "nlp_terms_required": ["<term>"],
  "content_gap": "<one specific angle or subtopic that none of the top 10 cover well>",
  "competing_urls": [
    {{ "url": "<url>", "title": "<title>", "weakness": "<one-sentence weakness>" }}
  ],
  "pages_analysed": {len(page_summaries)}
}}

Rules:
- consensus_h2s: H2s that appear in 4+ pages OR are structurally important. Max 8.
- nlp_terms_required: 10-20 terms that strong content MUST include to be semantically relevant.
- content_gap: Must be specific and actionable. Not "add more detail" — name the actual missing angle.
- competing_urls: List top 5 competing pages with a real weakness (thin coverage, outdated, no data, etc).
"""

    raw_parts: list[str] = []
    try:
        async with client.messages.stream(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                raw_parts.append(text)
    except Exception as exc:
        yield _sse({"type": "error", "error": f"Claude synthesis failed: {exc}"})
        return

    raw = "".join(raw_parts).strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        analysis = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return a minimal structure so the brief can still generate
        analysis = {
            "keyword": keyword,
            "avg_word_count": avg_word_count,
            "recommended_word_count": avg_word_count + 250,
            "consensus_h2s": [],
            "nlp_terms_required": consensus_nlp[:15],
            "content_gap": "Unable to parse — see raw output",
            "competing_urls": [],
            "pages_analysed": len(page_summaries),
            "_raw": raw[:500],
        }

    yield _sse({"type": "step", "label": "SERP analysis complete", "status": "done"})
    _set_cached(project_id, keyword, analysis)
    yield _sse({"type": "done", "analysis": analysis})
    yield "data: [DONE]\n\n"
