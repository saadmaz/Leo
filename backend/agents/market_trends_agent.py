import os
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.schemas.query_schema import QueryRequest
from dotenv import load_dotenv
import serpapi
from backend.tools.news_tools import get_funding_news, search_news
from backend.tools.gdelt_tools import get_trend_timeline, get_market_sentiment

load_dotenv()

class MarketTrendsAgent(BaseAgent):
    def __init__(self):
        super().__init__("MarketTrendsAgent")
        self.client = serpapi.Client(api_key=os.getenv("SERPAPI_API_KEY"))
        self._cache = {}

    def _cached_search(self, params: Dict[str, Any]) -> Dict[str, Any]:
        key = str(sorted(params.items()))
        if key not in self._cache:
            self._cache[key] = self.client.search(**params)
        return self._cache[key]

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product_name or query_context.company_name or query_context.query
        category = query_context.context.get("category", "AI SDR tools")

        findings = []
        evidence = []
        artifacts = []

        try:
            # 1. Interest over time (Google Trends)
            params_trends = {
                "engine": "google_trends",
                "q": f"{product},{category},sales automation",
                "geo": "US",
                "date": "today 12-m"
            }
            # Run in a thread pool if the client is blocking, but serpapi-python seems to be blocking.
            # For a hackathon, we can use it directly or wrap in run_in_executor.
            loop = asyncio.get_event_loop()
            trends = await loop.run_in_executor(None, self._cached_search, params_trends)
            
            timeline_data = trends.get("interest_over_time", {}).get("timeline_data", [])

            if timeline_data:
                recent_points = timeline_data[-8:]
                values = []
                for pt in recent_points:
                    try:
                        val = pt["values"][0].get("extracted_value", 0)
                        values.append(val)
                    except (IndexError, KeyError):
                        values.append(0)
                
                momentum = "accelerating" if values and values[-1] > values[0] else "declining"

                ev_id = str(uuid.uuid4())
                ev = Evidence(
                    id=ev_id,
                    source_type="google_trends",
                    url="https://trends.google.com",
                    title=f"Google Trends — {category}",
                    snippet=f"Last 12 months interest data for {category}. Recent momentum: {momentum}.",
                    collected_at=datetime.utcnow(),
                    entity=product,
                    tags=["trends", "search_volume"]
                )
                evidence.append(ev)

                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    statement=f"Search interest for '{category}' is {momentum} based on 12-month Google Trends data.",
                    type="fact",
                    confidence="high",
                    rationale="Derived from Google Trends interest_over_time data.",
                    domain="market_trends",
                    evidence_ids=[ev_id]
                ))

                artifacts.append(Artifact(
                    artifact_type="trend_timeline",
                    title=f"Search interest — {category} (12 months)",
                    payload=timeline_data
                ))

            # 2. Related rising queries
            params_related = {
                "engine": "google_trends",
                "q": category,
                "date": "today 12-m",
                "data_type": "RELATED_QUERIES"
            }
            related = await loop.run_in_executor(None, self._cached_search, params_related)
            rising = related.get("related_queries", {}).get("rising", [])[:5]

            if rising:
                rising_terms = ", ".join([r["query"] for r in rising])
                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    statement=f"Breakout search terms rising in this category: {rising_terms}.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Rising queries indicate emerging buyer language and adjacent product interest.",
                    domain="market_trends",
                    evidence_ids=[ev.id] if evidence else []
                ))

            # 3. Google News Search
            params_news = {
                "engine": "google_news",
                "q": f"{product} {category} launch 2025",
                "gl": "us",
                "hl": "en"
            }
            news_result = await loop.run_in_executor(None, self._cached_search, params_news)
            news_articles = news_result.get("news_results", [])[:3]

            for article in news_articles:
                ev_id = str(uuid.uuid4())
                evidence.append(Evidence(
                    id=ev_id,
                    source_type="google_news",
                    url=article.get("link"),
                    title=article.get("title", "News Article"),
                    snippet=article.get("snippet", ""),
                    collected_at=datetime.utcnow(),
                    entity=product,
                    tags=["news", category]
                ))
                
                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    statement=f"Recent news for {product}: {article.get('title')}",
                    type="fact",
                    confidence="high",
                    rationale="Extracted from Google News search results.",
                    domain="market_trends",
                    evidence_ids=[ev_id]
                ))

            # 4. NewsAPI Funding & Announcements
            if query_context.company_name:
                funding_news = await get_funding_news(query_context.company_name)
                for article in funding_news[:2]:
                    ev_id = str(uuid.uuid4())
                    evidence.append(Evidence(
                        id=ev_id,
                        source_type="newsapi",
                        url=article["url"],
                        title=article["title"],
                        snippet=article["snippet"],
                        collected_at=datetime.utcnow(),
                        entity=query_context.company_name,
                        tags=["funding", "news"]
                    ))
                    findings.append(Finding(
                        id=str(uuid.uuid4()),
                        statement=f"Detected funding signal for {query_context.company_name}: {article['title']}",
                        type="fact",
                        confidence="medium",
                        rationale="Derived from professional news sources via NewsAPI.",
                        domain="market_trends",
                        evidence_ids=[ev_id]
                    ))

            # 5. GDELT Sentiment & Global Trends
            gdelt_query = f'"{product}" OR "{category}"'
            sentiment = await get_market_sentiment(gdelt_query)
            if sentiment.get("mentions", 0) > 0:
                ev_id = str(uuid.uuid4())
                evidence.append(Evidence(
                    id=ev_id,
                    source_type="gdelt",
                    url="https://gdeltproject.org",
                    title="Global Sentiment Tracker (GDELT)",
                    snippet=f"Detected {sentiment['mentions']} global mentions. Sentiment score (tone): {sentiment['score']:.2f}.",
                    collected_at=datetime.utcnow(),
                    entity=product,
                    tags=["sentiment", "global_context"]
                ))
                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    statement=f"Global market sentiment for {product} is {'positive' if sentiment['score'] > 0 else 'neutral/negative'} (Score: {sentiment['score']:.2f}).",
                    type="interpretation",
                    confidence="medium",
                    rationale="Based on GDELT Project global event tracking data.",
                    domain="market_trends",
                    evidence_ids=[ev_id]
                ))

                gdelt_timeline = await get_trend_timeline(gdelt_query)
                if gdelt_timeline:
                    artifacts.append(Artifact(
                        artifact_type="gdelt_momentum",
                        title=f"Global Mention Momentum — {product}",
                        payload=gdelt_timeline
                    ))

        except Exception as e:
            return AgentOutput(
                agent_name=self.name,
                status="failed",
                findings=[],
                evidence=[],
                artifacts=[],
                errors=[str(e)]
            )

        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=[]
        )
