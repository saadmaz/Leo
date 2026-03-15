"""
Page scraping tool wrapper.
In production, replace with a real scraper (BeautifulSoup, Playwright, Firecrawl, etc.).
"""

import asyncio
import random
from datetime import datetime, timezone


async def scrape_page(url: str) -> dict:
    """
    Scrape a web page and return structured content.
    Returns: title, url, text_content, meta_description, collected_at.
    """
    await asyncio.sleep(random.uniform(0.3, 0.8))  # simulate scrape latency

    # Generate realistic mock content based on URL domain
    domain = url.split("//")[-1].split("/")[0].lower()

    content_map = {
        "techcrunch.com": {
            "title": "TechCrunch: Startup and Technology News",
            "text_content": (
                "The market is seeing unprecedented growth in AI-native tools. "
                "Funding rounds are getting larger, with three companies raising $100M+ Series C rounds this quarter. "
                "Enterprise buyers are shifting budget from legacy tools to modern, API-first platforms. "
                "Key trends include composable architecture, embedded AI, and vertical SaaS specialization."
            ),
            "meta_description": "Latest technology news and startup coverage.",
        },
        "g2.com": {
            "title": "G2: Business Software Reviews",
            "text_content": (
                "Category leaders maintain strong positions with 4.5+ star ratings. "
                "New entrants are gaining traction with developer-focused positioning. "
                "Feature comparison shows convergence around core capabilities with differentiation in AI features. "
                "Pricing ranges from freemium to $500+/mo enterprise tiers."
            ),
            "meta_description": "Real user reviews of business software.",
        },
        "producthunt.com": {
            "title": "Product Hunt: New Products and Launches",
            "text_content": (
                "Three new products launched this week targeting the same category. "
                "All emphasize AI-powered workflows and developer experience. "
                "Upvote counts suggest strong community interest in automation tools. "
                "Comments highlight demand for better integrations and API access."
            ),
            "meta_description": "The best new products in tech.",
        },
    }

    # Find matching content or generate generic
    matched = None
    for key, content in content_map.items():
        if key in domain:
            matched = content
            break

    if not matched:
        matched = {
            "title": f"Page content from {domain}",
            "text_content": (
                f"Content scraped from {url}. "
                "The page contains information about product features, pricing, and competitive positioning. "
                "Key themes include market growth, AI integration, and enterprise readiness."
            ),
            "meta_description": f"Content from {domain}",
        }

    return {
        "url": url,
        "title": matched["title"],
        "text_content": matched["text_content"],
        "meta_description": matched["meta_description"],
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }
