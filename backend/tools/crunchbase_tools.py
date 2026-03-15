import httpx
from typing import List, Dict, Any
from backend.config import settings

async def search_organizations(keyword: str, limit: int = 10) -> List[Dict]:
    """Search Crunchbase companies by keyword in their description."""
    if not settings.CRUNCHBASE_API_KEY:
        return []

    url = "https://api.crunchbase.com/api/v4/searches/organizations"
    headers = {
        "X-cb-user-key": settings.CRUNCHBASE_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "field_ids": [
            "identifier",
            "short_description",
            "funding_total",
            "last_funding_type",
            "num_employees_enum",
            "founded_on",
            "website_url"
        ],
        "query": [
            {
                "type": "predicate",
                "field_id": "facet_ids",
                "operator_id": "includes",
                "values": ["company"]
            },
            {
                "type": "predicate",
                "field_id": "short_description",
                "operator_id": "contains",
                "values": [keyword]
            }
        ],
        "limit": limit,
        "order": [
            {"field_id": "funding_total", "sort": "desc", "nulls": "last"}
        ]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            response.raise_for_status()
            return response.json().get("entities", [])
        except Exception:
            return []

async def get_company_detail(permalink: str) -> Dict[str, Any]:
    """Get detailed info for a specific company by its Crunchbase permalink."""
    if not settings.CRUNCHBASE_API_KEY:
        return {"error": "Missing Crunchbase API Key"}

    url = f"https://api.crunchbase.com/api/v4/entities/organizations/{permalink}"
    params = {
        "user_key": settings.CRUNCHBASE_API_KEY,
        "field_ids": "identifier,short_description,funding_total,last_funding_type,num_employees_enum,website_url,founded_on"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 404:
                return {"error": f"Company {permalink} not found in Crunchbase"}
            
            response.raise_for_status()
            data = response.json()
            return data.get("properties", {})
        except Exception as e:
            return {"error": str(e)}

async def get_funding_signals(category_keyword: str) -> List[Dict]:
    """Find recently funded companies in a category."""
    return await search_organizations(category_keyword, limit=15)
