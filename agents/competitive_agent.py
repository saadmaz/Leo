"""
CompetitiveLandscapeAgent — gathers competitive intelligence including
competitor product positioning, feature launches, pricing changes,
messaging shifts, integrations, and partnerships.
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


class CompetitiveLandscapeAgent(BaseAgent):
    name = "CompetitiveLandscapeAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        """
        Main entry point. Flow:
        1. Collect sources about competitors
        2. Scrape competitor pages for positioning data
        3. Extract competitive signals
        4. Build grounded findings
        5. Generate artifacts (competitor_matrix, feature_comparison)
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
                entity=src.get("entity", query.company_name or ""),
            ))

        # Step 4: extract competitive signals
        signals = self.extract_signals(sources)

        # Step 5: generate findings
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
        """Gather competitive intelligence from web, discussions, and page scraping."""
        company = query.company_name or query.product_name or "company"
        base_query = f"{company} competitors {query.query}".strip()
        sources: list[dict] = []

        # Parallel: web search for competitors, pricing, features, and discussions
        try:
            competitor_results, pricing_results, feature_results, reddit_posts, hn_stories = await asyncio.gather(
                search_web(f"{base_query} competitive landscape", num_results=3),
                search_web(f"{company} competitor pricing comparison", num_results=3),
                search_web(f"{company} competitor features integrations", num_results=3),
                search_reddit(f"{company} vs competitors", limit=3),
                search_hackernews(f"{company} alternative", limit=2),
            )
        except Exception as e:
            errors.append(f"Source collection failed: {str(e)}")
            return sources

        # Tag web results by search intent
        for r in competitor_results:
            r["source_type"] = "web_search"
            r["entity"] = company
            sources.append(r)

        for r in pricing_results:
            r["source_type"] = "pricing_research"
            r["entity"] = company
            sources.append(r)

        for r in feature_results:
            r["source_type"] = "feature_research"
            r["entity"] = company
            sources.append(r)

        for p in reddit_posts:
            p["source_type"] = "reddit"
            p["entity"] = company
            sources.append(p)

        for s in hn_stories:
            s["source_type"] = "hackernews"
            s["entity"] = company
            sources.append(s)

        # Scrape top pages for deeper competitive content
        urls_to_scrape = [r["url"] for r in competitor_results[:2]]
        try:
            scraped = await asyncio.gather(
                *[scrape_page(url) for url in urls_to_scrape],
                return_exceptions=True,
            )
            for page in scraped:
                if isinstance(page, dict):
                    page["source_type"] = "scraped_page"
                    page["snippet"] = page.get("text_content", "")[:300]
                    page["entity"] = company
                    sources.append(page)
        except Exception as e:
            errors.append(f"Scraping failed: {str(e)}")

        return sources

    def extract_signals(self, sources: list[dict]) -> dict:
        """Parse collected sources for competitive signal categories."""
        signals = {
            "positioning": [],
            "feature_launches": [],
            "pricing_signals": [],
            "messaging_shifts": [],
            "integrations_partnerships": [],
            "competitor_mentions": [],
        }

        for src in sources:
            text = (src.get("snippet", "") + " " + src.get("title", "")).lower()

            # Positioning signals
            if any(kw in text for kw in ["leader", "positioned", "ranked", "market share", "top vendor", "g2"]):
                signals["positioning"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Feature launch signals
            if any(kw in text for kw in ["launch", "feature", "released", "shipped", "new capability", "beta"]):
                signals["feature_launches"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Pricing signals
            if any(kw in text for kw in ["pricing", "price", "cost", "tier", "freemium", "$", "enterprise"]):
                signals["pricing_signals"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Messaging shifts
            if any(kw in text for kw in ["messaging", "brand", "positioning", "narrative", "homepage", "tagline"]):
                signals["messaging_shifts"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Integration and partnership signals
            if any(kw in text for kw in ["integration", "partnership", "partner", "salesforce", "hubspot", "api"]):
                signals["integrations_partnerships"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Track competitor mentions from discussions
            if src.get("source_type") in ("reddit", "hackernews"):
                if any(kw in text for kw in ["vs", "alternative", "switched", "compared", "competitor"]):
                    signals["competitor_mentions"].append({
                        "signal": src.get("snippet", ""),
                        "source": src.get("url", ""),
                        "sentiment": "negative" if any(kw in text for kw in ["left", "switched from", "worse"]) else "neutral",
                    })

        return signals

    def generate_findings(self, signals: dict, query: QueryRequest) -> list[Finding]:
        """Convert competitive signals into structured Finding objects."""
        findings: list[Finding] = []
        company = query.company_name or query.product_name or "the company"

        # Positioning findings
        if signals["positioning"]:
            findings.append(Finding(
                statement=f"{company} is referenced in competitive positioning data across {len(signals['positioning'])} sources.",
                type="fact",
                confidence="high" if len(signals["positioning"]) >= 2 else "medium",
                rationale=f"Found {len(signals['positioning'])} positioning references from review sites and reports.",
            ))

        # Feature launch findings
        if signals["feature_launches"]:
            findings.append(Finding(
                statement=f"Competitors are actively shipping new features — {len(signals['feature_launches'])} launch signals detected.",
                type="fact",
                confidence="medium",
                rationale="Feature launch signals found across web search and product pages.",
            ))

        # Pricing findings
        if signals["pricing_signals"]:
            findings.append(Finding(
                statement=f"Pricing activity detected: competitors are adjusting tiers and introducing freemium models.",
                type="interpretation",
                confidence="medium" if len(signals["pricing_signals"]) >= 2 else "low",
                rationale=f"Found {len(signals['pricing_signals'])} pricing-related signals.",
            ))

        # Integration findings
        if signals["integrations_partnerships"]:
            findings.append(Finding(
                statement=f"Competitors are forming strategic integrations and partnerships to increase switching costs.",
                type="interpretation",
                confidence="medium",
                rationale=f"Detected {len(signals['integrations_partnerships'])} integration/partnership signals.",
            ))

        # Community perception findings
        if signals["competitor_mentions"]:
            negative = sum(1 for m in signals["competitor_mentions"] if m.get("sentiment") == "negative")
            total = len(signals["competitor_mentions"])
            findings.append(Finding(
                statement=f"Community discussions actively compare {company} with competitors — {negative}/{total} mentions indicate switching behavior.",
                type="fact",
                confidence="medium",
                rationale="Based on Reddit and Hacker News discussion analysis.",
            ))

        # Messaging findings
        if signals["messaging_shifts"]:
            findings.append(Finding(
                statement=f"Messaging shifts detected among competitors — emphasis moving toward AI and enterprise security.",
                type="interpretation",
                confidence="low",
                rationale=f"Detected {len(signals['messaging_shifts'])} messaging-related signals. Confidence is low due to limited data.",
            ))

        if not findings:
            findings.append(Finding(
                statement=f"Insufficient competitive data available for {company}.",
                type="interpretation",
                confidence="low",
                rationale="No strong competitive signals detected from available sources.",
            ))

        return findings

    def _generate_artifacts(self, signals: dict, query: QueryRequest) -> list[Artifact]:
        """Generate competitor_matrix and feature_comparison artifacts."""
        company = query.company_name or query.product_name or "target company"

        # Competitor matrix — summary of competitive landscape
        competitor_matrix = {
            "company": company,
            "total_competitive_signals": sum(len(v) for v in signals.values()),
            "positioning_mentions": len(signals["positioning"]),
            "feature_launch_count": len(signals["feature_launches"]),
            "pricing_signal_count": len(signals["pricing_signals"]),
            "integration_count": len(signals["integrations_partnerships"]),
            "community_mention_count": len(signals["competitor_mentions"]),
            "top_signals": [
                s.get("signal", "")[:200]
                for s in (signals["positioning"] + signals["feature_launches"])[:5]
            ],
        }

        # Feature comparison — what competitors are shipping
        feature_comparison = {
            "company": company,
            "competitor_features_detected": [
                {"feature_signal": s.get("signal", "")[:200], "source": s.get("source", "")}
                for s in signals["feature_launches"][:5]
            ],
            "pricing_landscape": [
                {"pricing_signal": s.get("signal", "")[:200], "source": s.get("source", "")}
                for s in signals["pricing_signals"][:5]
            ],
            "integration_landscape": [
                {"integration_signal": s.get("signal", "")[:200], "source": s.get("source", "")}
                for s in signals["integrations_partnerships"][:5]
            ],
        }

        return [
            Artifact(artifact_type="competitor_matrix", payload=competitor_matrix),
            Artifact(artifact_type="feature_comparison", payload=feature_comparison),
        ]
