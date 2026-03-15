import asyncio

async def scrape_page(url: str):
    """Mock scraper."""
    await asyncio.sleep(0.3)
    return f"Simulated full text content of {url}. It contains mentions of market trends and pricing models."

async def extract_page_sections(content: str):
    """Mock section extractor."""
    return {
        "introduction": "Content summary...",
        "features": "Feature list...",
        "pricing": "Pricing section..."
    }
