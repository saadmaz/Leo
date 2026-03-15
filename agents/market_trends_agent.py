"""
MarketTrendsAgent — gathers market signals including category growth,
new product launches, hiring trends, discussion trends, emerging keywords,
and funding announcements.
"""

import asyncio
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput
from schemas.evidence_schema import Evidence
from schemas.artifact_schema import Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest
from tools.search_tools import search_web
from tools.scraper_tools import scrape_page
from tools.discussion_tools import search_reddit, search_hackernews


class MarketTrendsAgent(BaseAgent):
    name = "MarketTrendsAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        """
        Main entry point. Flow:
        1. Collect sources from web, Reddit, HN
        2. Scrape top pages for deeper content
        3. Extract signals from all collected data
        4. Build findings with confidence levels
        5. Generate artifacts (trend_timeline, signal_summary)
        6. Return structured AgentOutput
        """
        errors: list[str] = []
        evidence: list[Evidence] = []

        # Step 1 & 2: collect sources
        sources = await self.collect_sources(query, errors)

        # Step 3: convert raw sources to evidence
        for src in sources:
            evidence.append(Evidence(
                source_type=src.get("source_type", "web_search"),
                url=src.get("url", ""),
                title=src.get("title", ""),
                snippet=src.get("snippet", ""),
                collected_at=src.get("collected_at", datetime.now(timezone.utc).isoformat()),
                entity=query.company_name or query.product_name or "",
            ))

        # Step 4: extract signals from collected data
        signals = self.extract_signals(sources)

        # Step 5: generate findings from signals
        findings = self.generate_findings(signals, query)

        # Step 6: generate artifacts
        artifacts = self._generate_artifacts(signals, query)

        return AgentOutput(
            agent_name=self.name,
            status="success" if not errors else "error",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=errors,
        )

    async def collect_sources(self, query: QueryRequest, errors: list[str]) -> list[dict]:
        """Gather raw data from web search, Reddit, HN, and page scraping."""
        search_query = f"{query.company_name} {query.product_name} market trends {query.query}".strip()
        sources: list[dict] = []

        # Run web search, Reddit, and HN in parallel
        try:
            web_results, reddit_posts, hn_stories = await asyncio.gather(
                search_web(search_query, num_results=5),
                search_reddit(search_query, limit=3),
                search_hackernews(search_query, limit=3),
            )
        except Exception as e:
            errors.append(f"Source collection failed: {str(e)}")
            return sources

        # Tag and collect web results
        for r in web_results:
            r["source_type"] = "web_search"
            sources.append(r)

        # Tag and collect Reddit posts
        for p in reddit_posts:
            p["source_type"] = "reddit"
            sources.append(p)

        # Tag and collect HN stories
        for s in hn_stories:
            s["source_type"] = "hackernews"
            sources.append(s)

        # Scrape top 2 web result pages for deeper content
        urls_to_scrape = [r["url"] for r in web_results[:2]]
        scrape_tasks = [scrape_page(url) for url in urls_to_scrape]
        try:
            scraped_pages = await asyncio.gather(*scrape_tasks, return_exceptions=True)
            for page in scraped_pages:
                if isinstance(page, dict):
                    page["source_type"] = "scraped_page"
                    page["snippet"] = page.get("text_content", "")[:300]
                    sources.append(page)
        except Exception as e:
            errors.append(f"Scraping failed: {str(e)}")

        return sources

    def extract_signals(self, sources: list[dict]) -> dict:
        """
        Analyze collected sources and extract market signal categories.
        In production, this would use NLP or an LLM to extract real signals.
        Here we parse mock data for signal patterns.
        """
        signals = {
            "growth_indicators": [],
            "product_launches": [],
            "hiring_trends": [],
            "discussion_sentiment": [],
            "emerging_keywords": [],
            "funding_activity": [],
        }

        for src in sources:
            text = (src.get("snippet", "") + " " + src.get("title", "")).lower()

            # Detect growth signals
            if any(kw in text for kw in ["grow", "growth", "increase", "surge", "yoy", "projected"]):
                signals["growth_indicators"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                    "strength": "strong" if "yoy" in text or "projected" in text else "moderate",
                })

            # Detect product launches
            if any(kw in text for kw in ["launch", "new product", "released", "shipped", "show hn"]):
                signals["product_launches"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Detect hiring trends
            if any(kw in text for kw in ["hiring", "job", "openings", "posted", "recruiting"]):
                signals["hiring_trends"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Gauge discussion sentiment
            if src.get("source_type") in ("reddit", "hackernews"):
                sentiment = "positive"
                if any(kw in text for kw in ["crowded", "risk", "hype", "overrated"]):
                    sentiment = "cautious"
                elif any(kw in text for kw in ["great", "best", "love", "winning"]):
                    sentiment = "positive"
                signals["discussion_sentiment"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                    "sentiment": sentiment,
                })

            # Detect emerging keywords
            if any(kw in text for kw in ["ai-native", "composable", "open-source", "vertical saas", "api-first"]):
                matched = [kw for kw in ["ai-native", "composable", "open-source", "vertical saas", "api-first"] if kw in text]
                signals["emerging_keywords"].extend(matched)

            # Detect funding activity
            if any(kw in text for kw in ["funding", "raised", "series", "venture", "$"]):
                signals["funding_activity"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

        # Deduplicate emerging keywords
        signals["emerging_keywords"] = list(set(signals["emerging_keywords"]))

        return signals

    def generate_findings(self, signals: dict, query: QueryRequest) -> list[Finding]:
        """Convert extracted signals into structured Finding objects with confidence levels."""
        findings: list[Finding] = []
        market = query.company_name or query.product_name or "the target market"

        # Growth findings
        if signals["growth_indicators"]:
            strength = signals["growth_indicators"][0].get("strength", "moderate")
            confidence = "high" if len(signals["growth_indicators"]) >= 2 else "medium"
            findings.append(Finding(
                statement=f"The {market} market shows {strength} growth signals across multiple sources.",
                type="fact",
                confidence=confidence,
                rationale=f"Detected {len(signals['growth_indicators'])} growth indicators from web and discussion sources.",
            ))

        # Product launch findings
        if signals["product_launches"]:
            findings.append(Finding(
                statement=f"New product launches detected in the {market} space, indicating active market entry.",
                type="fact",
                confidence="medium" if len(signals["product_launches"]) >= 2 else "low",
                rationale=f"Found {len(signals['product_launches'])} recent product launch signals.",
            ))

        # Hiring findings
        if signals["hiring_trends"]:
            findings.append(Finding(
                statement=f"Hiring activity in the {market} space is elevated, suggesting expansion across vendors.",
                type="interpretation",
                confidence="medium",
                rationale=f"Detected {len(signals['hiring_trends'])} hiring-related signals.",
            ))

        # Discussion sentiment findings
        if signals["discussion_sentiment"]:
            cautious = sum(1 for s in signals["discussion_sentiment"] if s["sentiment"] == "cautious")
            total = len(signals["discussion_sentiment"])
            if cautious > total / 2:
                findings.append(Finding(
                    statement=f"Community sentiment around {market} is cautious — concerns about market crowding.",
                    type="interpretation",
                    confidence="medium",
                    rationale=f"{cautious}/{total} discussion sources express caution.",
                ))
            else:
                findings.append(Finding(
                    statement=f"Community sentiment around {market} is generally positive with strong interest.",
                    type="interpretation",
                    confidence="medium",
                    rationale=f"Majority of {total} discussion sources are positive.",
                ))

        # Emerging keyword findings
        if signals["emerging_keywords"]:
            kw_list = ", ".join(signals["emerging_keywords"])
            findings.append(Finding(
                statement=f"Emerging keywords in the space: {kw_list}.",
                type="fact",
                confidence="medium",
                rationale="Keywords extracted from web search and community discussions.",
            ))

        # Funding findings
        if signals["funding_activity"]:
            findings.append(Finding(
                statement=f"Active funding rounds detected in the {market} space, signaling investor confidence.",
                type="fact",
                confidence="high" if len(signals["funding_activity"]) >= 2 else "medium",
                rationale=f"Found {len(signals['funding_activity'])} funding-related signals.",
            ))

        # Fallback if no signals found
        if not findings:
            findings.append(Finding(
                statement=f"Insufficient data to determine clear market trends for {market}.",
                type="interpretation",
                confidence="low",
                rationale="No strong signals detected from available sources.",
            ))

        return findings

    def _generate_artifacts(self, signals: dict, query: QueryRequest) -> list[Artifact]:
        """Generate trend_timeline and signal_summary artifacts."""
        market = query.company_name or query.product_name or "target market"

        # Trend timeline artifact
        timeline_entries = []
        for category in ["growth_indicators", "product_launches", "funding_activity"]:
            for sig in signals.get(category, []):
                timeline_entries.append({
                    "category": category,
                    "signal": sig.get("signal", "")[:200],
                    "source": sig.get("source", ""),
                })

        # Signal summary artifact
        signal_summary = {
            "market": market,
            "total_sources_analyzed": sum(len(v) if isinstance(v, list) else 0 for v in signals.values()),
            "growth_signal_count": len(signals["growth_indicators"]),
            "product_launch_count": len(signals["product_launches"]),
            "hiring_signal_count": len(signals["hiring_trends"]),
            "funding_signal_count": len(signals["funding_activity"]),
            "emerging_keywords": signals["emerging_keywords"],
            "discussion_sentiment_breakdown": {
                "positive": sum(1 for s in signals["discussion_sentiment"] if s.get("sentiment") == "positive"),
                "cautious": sum(1 for s in signals["discussion_sentiment"] if s.get("sentiment") == "cautious"),
            },
        }

        return [
            Artifact(artifact_type="trend_timeline", payload={"entries": timeline_entries}),
            Artifact(artifact_type="signal_summary", payload=signal_summary),
        ]
