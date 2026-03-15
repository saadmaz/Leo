import httpx
import random
from typing import List, Dict, Any
from backend.config import settings

from collections import Counter

async def search_hiring_signals(query: str, country: str = "us", results: int = 20) -> List[Dict]:
    """
    Deep search for hiring signals (job postings) using Adzuna API.
    """
    if not settings.ADZUNA_APP_ID or not settings.ADZUNA_APP_KEY:
        return []

    url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/1"
    
    params = {
        "app_id": settings.ADZUNA_APP_ID,
        "app_key": settings.ADZUNA_APP_KEY,
        "results_per_page": results,
        "what": query,
        "content-type": "application/json",
        "sort_by": "date"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])
        except Exception:
            return []

async def get_hiring_velocity(company_name: str) -> Dict[str, Any]:
    """How aggressively is a company hiring right now?"""
    jobs = await search_hiring_signals(company_name)
    role_types = [job.get("title", "") for job in jobs]

    return {
        "total_open_roles": len(jobs),
        "role_titles": role_types[:10],
        "companies_hiring": list({job.get("company", {}).get("display_name", "") for job in jobs})[:5],
        "most_recent_post": jobs[0].get("created") if jobs else None
    }

async def get_category_hiring_trends(category_keyword: str) -> Dict[str, Any]:
    """What roles dominate in a category? Reveals strategic priorities."""
    jobs = await search_hiring_signals(category_keyword, results=50)

    role_counter = Counter()
    company_counter = Counter()

    for job in jobs:
        title = job.get("title", "").lower()
        company = job.get("company", {}).get("display_name", "")

        # Classify role type
        if any(w in title for w in ["engineer", "developer", "ml", "ai", "data"]):
            role_counter["engineering"] += 1
        elif any(w in title for w in ["sales", "sdr", "account executive", "ae"]):
            role_counter["sales"] += 1
        elif any(w in title for w in ["marketing", "growth", "demand"]):
            role_counter["marketing"] += 1
        elif any(w in title for w in ["product", "pm", "manager"]):
            role_counter["product"] += 1
        else:
            role_counter["other"] += 1

        if company:
            company_counter[company] += 1

    return {
        "total_postings": len(jobs),
        "role_breakdown": dict(role_counter),
        "top_hiring_companies": company_counter.most_common(5),
        "sample_titles": [j.get("title") for j in jobs[:8]]
    }
