import asyncio
import os
import sys
from pprint import pprint

# Set PYTHONPATH to root
sys.path.append(os.getcwd())

from backend.tools.news_tools import search_news, get_funding_news
from backend.tools.crunchbase_tools import search_organizations
from backend.tools.hiring_tools import get_hiring_velocity
from backend.tools.domain_tools import get_team_composition
from backend.tools.techstack_tools import analyze_gtm_signals
from backend.tools.gdelt_tools import get_market_sentiment

async def test_tools():
    print("🚀 Testing API Tools Integration...")
    
    test_company = "OpenAI"
    test_domain = "openai.com"
    test_category = "AI SDR"

    print(f"\n1. Testing NewsAPI (Funding search for {test_company})...")
    news = await get_funding_news(test_company)
    print(f"   Found {len(news)} articles.")

    print(f"\n2. Testing Crunchbase (Searching for {test_category})...")
    cb = await search_organizations(test_category, limit=2)
    print(f"   Found {len(cb)} organizations.")

    print(f"\n3. Testing Adzuna (Hiring velocity for {test_company})...")
    hiring = await get_hiring_velocity(test_company)
    print(f"   Open roles: {hiring.get('total_open_roles')}")

    print(f"\n4. Testing Hunter.io (Team composition for {test_domain})...")
    team = await get_team_composition(test_domain)
    if "error" in team:
        print(f"   Hunter.io Error: {team['error']}")
    else:
        print(f"   Total emails: {team.get('total_emails_found')}")

    print(f"\n5. Testing BuiltWith/Firecrawl (GTM for {test_domain})...")
    gtm = await analyze_gtm_signals(test_domain)
    if "error" in gtm:
        print(f"   GTM Error: {gtm['error']}")
    else:
        print(f"   GTM Signals: {gtm.get('stack_signals')}")

    print(f"\n6. Testing GDELT (Sentiment for {test_category})...")
    sentiment = await get_market_sentiment(test_category)
    print(f"   Sentiment score: {sentiment.get('score')} ({sentiment.get('mentions')} mentions)")

if __name__ == "__main__":
    asyncio.run(test_tools())
