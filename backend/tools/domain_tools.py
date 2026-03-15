import httpx
from typing import List, Dict, Any
from backend.config import settings

async def find_domain_emails(domain: str) -> Dict[str, Any]:
    """Retrieve email patterns and team info for a competitor domain."""
    if not settings.HUNTER_API_KEY:
        return {"error": "Missing Hunter.io API Key"}

    url = "https://api.hunter.io/v2/domain-search"
    params = {
        "domain": domain,
        "api_key": settings.HUNTER_API_KEY
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data.get("data", {})
        except Exception as e:
            return {"error": str(e)}

async def get_team_composition(domain: str) -> Dict[str, Any]:
    """Analyze department breakdown of a company via their email footprint."""
    data = await find_domain_emails(domain)
    if "error" in data:
        return data

    emails = data.get("emails", [])
    departments = {}
    for email in emails:
        dept = email.get("department")
        if dept:
            departments[dept] = departments.get(dept, 0) + 1
    
    return {
        "domain": domain,
        "total_emails_found": data.get("results", 0),
        "department_breakdown": departments,
        "pattern": data.get("pattern")
    }
