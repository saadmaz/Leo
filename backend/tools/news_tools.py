import asyncio
import random
from typing import List, Dict

async def search_news(query: str) -> List[Dict]:
    """
    Search for recent news relevant to the query using NewsAPI.
    Note: In a production environment, this would use an API key.
    """
    await asyncio.sleep(0.5)
    # Simulated NewsAPI response
    return [
        {
            "title": f"Recent expansion in {query} sector",
            "source": "TechCrunch",
            "url": f"https://techcrunch.com/news/{random.randint(1000, 9999)}",
            "published_at": "2024-03-15T10:00:00Z",
            "snippet": f"Market analysis shows significant growth patterns for {query}..."
        },
        {
            "title": f"Industry report: The future of {query}",
            "source": "Reuters",
            "url": f"https://reuters.com/business/{random.randint(1000, 9999)}",
            "published_at": "2024-03-14T15:30:00Z",
            "snippet": f"Experts weigh in on the competitive dynamics of {query}."
        }
    ]
