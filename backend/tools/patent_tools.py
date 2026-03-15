import httpx
from typing import List, Dict
from backend.config import settings

async def search_patents(query: str) -> List[Dict]:
    """
    Search for USPTO patents related to the query.
    Note: USPTO Open Data Portal API (v1).
    """
    url = "https://developer.uspto.gov/ibd-api/v1/patent/search"
    # Note: USPTO API parameters vary, this is a simplified example based on their common search pattern
    params = {
        "searchText": query,
        "rows": 3
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("results", [])
            return [
                {
                    "patent_number": r.get("patentNumber"),
                    "title": r.get("patentTitle"),
                    "assignee": r.get("assignee"),
                    "abstract": r.get("abstractText"),
                    "filing_date": r.get("filingDate")
                }
                for r in results
            ]
        except Exception as e:
            return [{"error": str(e)}]
