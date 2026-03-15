"""
Lightweight page scraping tools.
Uses httpx + basic HTML text extraction. No heavyweight browser dependency.
"""

import re
import httpx
from datetime import datetime, timezone

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LeoBot/1.0)"},
        )
    return _client


def _strip_html(html: str) -> str:
    """Naive HTML tag stripper — good enough for hackathon."""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


async def scrape_page(url: str) -> dict:
    """Fetch a URL and return cleaned text content."""
    try:
        client = await _get_client()
        resp = await client.get(url)
        resp.raise_for_status()
        html = resp.text
        text = _strip_html(html)

        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        return {
            "url": str(resp.url),
            "title": title,
            "text": text[:5000],  # cap at 5k chars
            "status": resp.status_code,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {
            "url": url,
            "title": "",
            "text": "",
            "status": 0,
            "error": str(e),
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }


async def extract_page_sections(url: str) -> dict:
    """Scrape a page and split into rough sections (hero, body, footer)."""
    page = await scrape_page(url)
    text = page.get("text", "")
    if not text:
        return {**page, "sections": {}}

    words = text.split()
    total = len(words)
    third = max(total // 3, 1)

    sections = {
        "hero": " ".join(words[:third]),
        "body": " ".join(words[third : third * 2]),
        "footer": " ".join(words[third * 2 :]),
    }
    return {**page, "sections": sections}
