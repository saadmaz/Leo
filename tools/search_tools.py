"""
Lightweight search tool wrappers.
Hackathon-grade: uses httpx + fallback to mock data when APIs are unavailable.
"""

import os
import httpx
from datetime import datetime, timezone

SERP_API_KEY = os.getenv("SERP_API_KEY", "")
SERP_BASE = "https://serpapi.com/search"

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=15.0)
    return _client


async def search_web(query: str, num_results: int = 5) -> list[dict]:
    """Search the web via SerpAPI (Google). Falls back to empty list."""
    if not SERP_API_KEY:
        return _mock_web_results(query, num_results)
    try:
        client = await _get_client()
        resp = await client.get(
            SERP_BASE,
            params={"q": query, "api_key": SERP_API_KEY, "num": num_results, "engine": "google"},
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for item in data.get("organic_results", [])[:num_results]:
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source_type": "web_search",
                "collected_at": datetime.now(timezone.utc).isoformat(),
            })
        return results
    except Exception:
        return []


async def search_reddit(query: str, num_results: int = 5) -> list[dict]:
    """Search Reddit via web search with site filter."""
    return await search_web(f"site:reddit.com {query}", num_results)


async def search_hackernews(query: str, num_results: int = 5) -> list[dict]:
    """Search Hacker News via the Algolia HN API."""
    try:
        client = await _get_client()
        resp = await client.get(
            "https://hn.algolia.com/api/v1/search",
            params={"query": query, "hitsPerPage": num_results},
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for hit in data.get("hits", [])[:num_results]:
            results.append({
                "title": hit.get("title") or hit.get("story_title", ""),
                "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}",
                "snippet": (hit.get("comment_text") or hit.get("story_text") or "")[:300],
                "source_type": "hackernews",
                "collected_at": datetime.now(timezone.utc).isoformat(),
            })
        return results
    except Exception:
        return []


def _mock_web_results(query: str, num: int) -> list[dict]:
    """Fallback mock results when no API key is set."""
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "title": f"Result for: {query}",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}",
            "snippet": f"Simulated search result snippet for '{query}'. Replace SERP_API_KEY to get live data.",
            "source_type": "web_search_mock",
            "collected_at": now,
        }
    ][:num]
