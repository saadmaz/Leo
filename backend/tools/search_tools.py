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
    """
    Search Reddit for community discussions.
    In production, this would use PRAW or a similar wrapper.
    """
    await asyncio.sleep(0.4)
    return [
        {"title": f"Does anyone use {query} for growth?", "url": "https://reddit.com/r/SaaS/123", "score": random.randint(10, 500), "snippet": "I've been looking into it but wanted to see if the community has thoughts."},
        {"title": f"Comparison: {query} vs Competitor X", "url": "https://reddit.com/r/ai/456", "score": random.randint(50, 1000), "snippet": "The UI is better on X but the features here are more robust."}
    ]

async def search_hackernews(query: str):
    """
    Search Hacker News via Algolia API.
    """
    await asyncio.sleep(0.4)
    return [
        {"title": f"Show HN: {query} Alternative", "url": "https://news.ycombinator.com/item?id=789", "points": random.randint(5, 100), "snippet": "We built this to solve the latency issues we saw in other platforms."},
        {"title": f"Discussion: The state of {query} in 2024", "url": "https://news.ycombinator.com/item?id=012", "points": random.randint(20, 300), "snippet": "Interesting thread about the market shift towards these types of agents."}
    ]
