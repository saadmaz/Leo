import httpx
from typing import List, Dict, Any
from backend.config import settings

async def web_search(query: str) -> List[Dict[str, Any]]:
    """
    Search the web using SerpAPI.
    """
    if not settings.SERPAPI_API_KEY or "your_" in settings.SERPAPI_API_KEY:
        return [{"title": "Mock Result", "url": "https://example.com", "snippet": "SerpAPI key missing."}]
    
    params = {
        "q": query,
        "api_key": settings.SERPAPI_API_KEY,
        "engine": "google"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("https://serpapi.com/search", params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for res in data.get("organic_results", [])[:5]:
                results.append({
                    "title": res.get("title"),
                    "link": res.get("link"),
                    "snippet": res.get("snippet")
                })
            return results
        except Exception as e:
            print(f"SerpAPI error: {e}")
            return [{"error": str(e)}]

async def hiring_search(query: str, location: str = "us") -> List[Dict[str, Any]]:
    """
    Search for hiring signals using Adzuna.
    """
    if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
        return [{"title": "Mock Result", "snippet": "Adzuna keys missing."}]
        
    url = f"https://api.adzuna.com/v1/api/jobs/{location}/search/1"
    params = {
        "app_id": settings.ADZUNA_APP_ID,
        "app_key": settings.ADZUNA_APP_KEY,
        "what": query,
        "content-type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for job in data.get("results", [])[:5]:
                results.append({
                    "title": job.get("title"),
                    "company": job.get("company", {}).get("display_name"),
                    "location": job.get("location", {}).get("display_name"),
                    "description": job.get("description"),
                    "redirect_url": job.get("redirect_url")
                })
            return results
        except Exception as e:
            print(f"Adzuna error: {e}")
            return [{"error": str(e)}]
