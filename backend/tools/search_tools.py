import httpx
from typing import List, Dict
from backend.config import settings

async def search_web(query: str) -> List[Dict]:
    """
    Real web search using SerpAPI.
    """
    if not settings.SERPAPI_API_KEY:
        return [{"error": "Missing SerpAPI Key"}]

    url = "https://serpapi.com/search"
    params = {
        "q": query,
        "api_key": settings.SERPAPI_API_KEY,
        "engine": "google",
        "num": 5
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("organic_results", [])
            return [
                {
                    "title": r.get("title"),
                    "url": r.get("link"),
                    "snippet": r.get("snippet")
                }
                for r in results
            ]
        except Exception as e:
            return [{"error": str(e)}]

async def search_reddit(query: str) -> List[Dict]:
    """
    Search Reddit using SerpAPI with site constraint.
    """
    return await search_web(f"site:reddit.com {query}")

async def search_hackernews(query: str) -> List[Dict]:
    """
    Search Hacker News using SerpAPI with site constraint.
    """
    return await search_web(f"site:news.ycombinator.com {query}")
