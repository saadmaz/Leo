import asyncio
import random
from typing import Dict, Any

async def get_company_intel(company_name: str) -> Dict[str, Any]:
    """
    Retrieve financial and structural intelligence for a company from Crunchbase.
    """
    await asyncio.sleep(0.6)
    # Simulated Crunchbase response
    return {
        "name": company_name,
        "funding_total": f"${random.randint(50, 500)}M",
        "last_funding_round": "Series C",
        "employee_count": f"{random.randint(100, 1000)}+",
        "headquarters": "San Francisco, CA",
        "description": f"{company_name} is a leading player in the intelligence systems space.",
        "executives": ["Jane Doe (CEO)", "John Smith (CTO)"]
    }
