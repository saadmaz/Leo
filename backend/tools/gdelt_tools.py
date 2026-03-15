import httpx
from typing import List, Dict, Any
import json

async def search_gdelt(query: str, mode: str = "artlist") -> List[Dict]:
    """
    Search GDELT Project for global event news and mentions.
    GDELT is free and doesn't require a key.
    """
    # GDELT DOC API v2
    base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": mode,
        "format": "json",
        "maxrecords": 50,
        "timespan": "1m" # Last 1 month
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=15.0)
            if response.status_code != 200:
                return []
            
            data = response.json()
            return data.get("articles", [])
        except Exception:
            return []

async def get_trend_timeline(query: str) -> List[Dict]:
    """Get frequency of mentions over time for a trend (powers small sparklines)."""
    base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "timelinevol",
        "format": "json",
        "timespan": "3m"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=15.0)
            data = response.json()
            return data.get("timeline", [{}])[0].get("data", [])
        except Exception:
            return []

async def get_market_sentiment(query: str) -> Dict[str, Any]:
    """Get average sentiment (tone) for a topic."""
    base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "tonechart",
        "format": "json"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(base_url, params=params, timeout=15.0)
            data = response.json()
            # Calculate average tone
            tones = data.get("tonechart", [])
            if not tones: return {"score": 0}
            
            avg_tone = sum(t.get("bin", 0) * t.get("count", 0) for t in tones) / sum(t.get("count", 1) for t in tones)
            return {"score": avg_tone, "mentions": sum(t.get("count", 0) for t in tones)}
        except Exception:
            return {"score": 0}
