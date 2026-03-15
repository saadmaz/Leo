import httpx
from typing import List, Dict, Any
from backend.config import settings

async def search_news(query: str, days_back: int = 30) -> List[Dict]:
    """
    Search for recent news relevant to the query using NewsAPI.
    """
    if not settings.NEWSAPI_KEY:
        return [{"error": "Missing NewsAPI Key"}]

    from datetime import datetime, timedelta
    from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "from": from_date,
        "apiKey": settings.NEWSAPI_KEY,
        "pageSize": 20,
        "sortBy": "publishedAt",
        "language": "en"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            articles = data.get("articles", [])
            return [
                {
                    "title": a["title"],
                    "source": a["source"]["name"],
                    "url": a["url"],
                    "published_at": a["publishedAt"],
                    "snippet": a["description"]
                }
                for a in articles
            ]
        except Exception as e:
            return [{"error": str(e)}]

async def get_top_headlines(query: str) -> List[Dict]:
    """Get top headlines mentioning a product or category."""
    if not settings.NEWSAPI_KEY:
        return []

    url = "https://newsapi.org/v2/top-headlines"
    params = {
        "q": query,
        "apiKey": settings.NEWSAPI_KEY,
        "language": "en",
        "pageSize": 10
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data.get("articles", [])
        except Exception:
            return []

async def get_funding_news(company: str) -> List[Dict]:
    """Specifically search for funding/investment news."""
    query = f'"{company}" funding OR investment OR raises OR "Series A" OR "Series B"'
    return await search_news(query, days_back=90)
