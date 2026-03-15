import asyncio
import random
from typing import List, Dict

async def search_hiring_signals(query: str) -> List[Dict]:
    """
    Deep search for hiring signals (job postings) using Adzuna API.
    """
    await asyncio.sleep(0.5)
    # Simulated Adzuna response
    roles = ["Software Engineer", "Product Manager", "Sales Lead", "AI Research Scientist"]
    return [
        {
            "title": random.choice(roles),
            "company": query,
            "location": "Remote / New York",
            "description": f"Seeking experts to help scale our {query} initiatives.",
            "posted_at": "2024-03-10"
        }
        for _ in range(3)
    ]
