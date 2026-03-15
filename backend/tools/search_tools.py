import asyncio
import random

async def search_web(query: str):
    """Mock web search."""
    await asyncio.sleep(0.5)
    return [
        {"title": f"Result for {query}", "url": f"https://example.com/{random.randint(1,100)}", "snippet": f"This is a simulated search result for {query}."}
        for _ in range(3)
    ]

async def search_reddit(query: str):
    """Mock reddit search."""
    await asyncio.sleep(0.4)
    return [
        {"title": f"Reddit thread about {query}", "url": f"https://reddit.com/r/ai/{random.randint(1,100)}", "snippet": "User context on growth and competition."}
    ]

async def search_hackernews(query: str):
    """Mock HN search."""
    await asyncio.sleep(0.4)
    return [
        {"title": f"Show HN: {query} alternative", "url": "https://news.ycombinator.com/item?id=123", "snippet": "Discussion on competitive landscape."}
    ]
