"""
Discussion platform tool wrappers for Reddit and Hacker News.
In production, replace with real APIs (Reddit API, HN Algolia API, etc.).
"""

import asyncio
import random
from datetime import datetime, timezone


async def search_reddit(query: str, subreddit: str = "", limit: int = 5) -> list[dict]:
    """
    Search Reddit for discussions matching a query.
    Returns a list of posts with: title, url, subreddit, score, num_comments, snippet, created_at.
    """
    await asyncio.sleep(random.uniform(0.2, 0.5))

    subreddits = subreddit.split(",") if subreddit else [
        "SaaS", "startups", "technology", "programming", "ProductManagement"
    ]

    mock_posts = [
        {
            "title": f"What's everyone using for {query}?",
            "url": f"https://reddit.com/r/{random.choice(subreddits)}/comments/abc123",
            "subreddit": random.choice(subreddits),
            "score": random.randint(50, 500),
            "num_comments": random.randint(20, 150),
            "snippet": (
                f"We evaluated 5 tools for {query} and ended up going with a newer entrant. "
                "The legacy players are too expensive and slow to ship features. "
                "AI-native tools are winning on UX and time-to-value."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"Is {query} market getting too crowded?",
            "url": f"https://reddit.com/r/{random.choice(subreddits)}/comments/def456",
            "subreddit": random.choice(subreddits),
            "score": random.randint(30, 300),
            "num_comments": random.randint(15, 80),
            "snippet": (
                f"The {query} space has exploded in the last year. "
                "I've seen at least 10 new startups launching. "
                "Differentiation is becoming harder — most tools offer similar core features. "
                "Pricing and integrations seem to be the main battleground."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"{query} - which startup is most underrated?",
            "url": f"https://reddit.com/r/{random.choice(subreddits)}/comments/ghi789",
            "subreddit": random.choice(subreddits),
            "score": random.randint(20, 200),
            "num_comments": random.randint(10, 60),
            "snippet": (
                f"There are a couple of underrated tools in the {query} space. "
                "One is a small team that just raised a seed round and is shipping fast. "
                "Another is a pivot from an adjacent market — they have strong tech but need better marketing."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"We switched from [BigCo] to a {query} startup - here's what happened",
            "url": f"https://reddit.com/r/{random.choice(subreddits)}/comments/jkl012",
            "subreddit": random.choice(subreddits),
            "score": random.randint(100, 800),
            "num_comments": random.randint(40, 200),
            "snippet": (
                f"After 2 years on a legacy {query} platform, we switched to a startup. "
                "Onboarding was 10x faster, pricing was 60% lower, and the API was actually usable. "
                "The main risk is vendor stability — they're still pre-Series B."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"Big platform just announced {query} features — should startups worry?",
            "url": f"https://reddit.com/r/{random.choice(subreddits)}/comments/mno345",
            "subreddit": random.choice(subreddits),
            "score": random.randint(60, 400),
            "num_comments": random.randint(25, 120),
            "snippet": (
                f"A major platform just shipped native {query} capabilities. "
                "It's basic right now but they have distribution. "
                "Startups need to go deeper on specialization or risk being commoditized. "
                "Integration moats are the best defense."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    return random.sample(mock_posts, min(limit, len(mock_posts)))


async def search_hackernews(query: str, limit: int = 5) -> list[dict]:
    """
    Search Hacker News for discussions matching a query.
    Returns a list of stories with: title, url, score, num_comments, snippet, created_at.
    """
    await asyncio.sleep(random.uniform(0.2, 0.5))

    mock_stories = [
        {
            "title": f"Show HN: We built an open-source alternative for {query}",
            "url": f"https://news.ycombinator.com/item?id={random.randint(30000000, 40000000)}",
            "score": random.randint(50, 500),
            "num_comments": random.randint(30, 200),
            "snippet": (
                f"Open-source {query} tool gaining traction on HN. "
                "Comments highlight strong developer interest. "
                "Self-hosted option appeals to privacy-conscious enterprises. "
                "Main criticism: lacks enterprise features like SSO and audit logs."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"The {query} landscape is about to change dramatically",
            "url": f"https://news.ycombinator.com/item?id={random.randint(30000000, 40000000)}",
            "score": random.randint(100, 800),
            "num_comments": random.randint(50, 300),
            "snippet": (
                f"Blog post arguing that AI will fundamentally reshape the {query} market. "
                "Key prediction: 50% of current vendors will be irrelevant in 3 years. "
                "Comments are split — some agree AI changes everything, others say it's hype."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"Ask HN: Best {query} tool for a small team?",
            "url": f"https://news.ycombinator.com/item?id={random.randint(30000000, 40000000)}",
            "score": random.randint(30, 200),
            "num_comments": random.randint(20, 100),
            "snippet": (
                f"Discussion thread comparing {query} tools for small teams. "
                "Top recommendations focus on simplicity and pricing. "
                "Developer experience and API quality are top decision factors. "
                "Several commenters recommend newer AI-native entrants."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"Why we left {query} vendor X for vendor Y",
            "url": f"https://news.ycombinator.com/item?id={random.randint(30000000, 40000000)}",
            "score": random.randint(40, 350),
            "num_comments": random.randint(25, 150),
            "snippet": (
                f"Detailed post-mortem on switching {query} tools. "
                "Main drivers: pricing increase, slow feature development, poor support. "
                "New vendor offers better integrations and faster iteration. "
                "Commenters share similar migration experiences."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "title": f"Funding: {query} startup raises $50M Series B",
            "url": f"https://news.ycombinator.com/item?id={random.randint(30000000, 40000000)}",
            "score": random.randint(80, 600),
            "num_comments": random.randint(40, 250),
            "snippet": (
                f"A {query} startup announced a $50M Series B led by a top-tier VC. "
                "Company claims 300% ARR growth and 500+ enterprise customers. "
                "Comments debate whether the market can sustain this many well-funded players."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    return random.sample(mock_stories, min(limit, len(mock_stories)))
