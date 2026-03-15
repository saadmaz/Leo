"""
Web search tool wrapper.
In production, replace the mock with a real API (Tavily, SerpAPI, Brave Search, etc.).
"""

import asyncio
import random
from datetime import datetime, timezone


async def search_web(query: str, num_results: int = 5) -> list[dict]:
    """
    Search the web for a query and return structured results.
    Each result contains: title, url, snippet, source.
    """
    await asyncio.sleep(random.uniform(0.2, 0.6))  # simulate API latency

    # Mock results keyed on common signal keywords
    mock_db = [
        {
            "title": f"Market Analysis: {query}",
            "url": f"https://techcrunch.com/2026/market-{query.replace(' ', '-').lower()[:30]}",
            "snippet": f"The market for {query} is projected to grow 35% YoY, driven by enterprise adoption and AI integration.",
            "source": "techcrunch.com",
        },
        {
            "title": f"{query} - Industry Report 2026",
            "url": f"https://cbinsights.com/research/{query.replace(' ', '-').lower()[:30]}",
            "snippet": f"Funding in the {query} space reached $4.2B in Q1 2026, a 60% increase from the prior year.",
            "source": "cbinsights.com",
        },
        {
            "title": f"Top Companies in {query}",
            "url": f"https://g2.com/categories/{query.replace(' ', '-').lower()[:30]}",
            "snippet": f"G2 lists 45 vendors in the {query} category. Leaders include established SaaS players and emerging AI-native startups.",
            "source": "g2.com",
        },
        {
            "title": f"{query} Hiring Surge",
            "url": f"https://linkedin.com/pulse/{query.replace(' ', '-').lower()[:30]}-hiring",
            "snippet": f"Companies in the {query} space posted 12,000+ job openings in the last 90 days, up 40% quarter-over-quarter.",
            "source": "linkedin.com",
        },
        {
            "title": f"New Product Launches in {query}",
            "url": f"https://producthunt.com/topics/{query.replace(' ', '-').lower()[:30]}",
            "snippet": f"Three new {query} products launched this week, focusing on AI-powered automation and developer experience.",
            "source": "producthunt.com",
        },
        {
            "title": f"{query} Pricing Comparison",
            "url": f"https://capterra.com/{query.replace(' ', '-').lower()[:30]}/pricing",
            "snippet": f"Average pricing for {query} tools ranges from $29/mo for startups to $500+/mo for enterprise tiers.",
            "source": "capterra.com",
        },
        {
            "title": f"{query} Partnership Announcements",
            "url": f"https://businesswire.com/{query.replace(' ', '-').lower()[:30]}-partnerships",
            "snippet": f"Two major {query} vendors announced strategic integrations with Salesforce and HubSpot this quarter.",
            "source": "businesswire.com",
        },
    ]

    results = random.sample(mock_db, min(num_results, len(mock_db)))
    for r in results:
        r["collected_at"] = datetime.now(timezone.utc).isoformat()
    return results
