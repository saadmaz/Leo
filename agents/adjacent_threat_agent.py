"""
AdjacentThreatAgent — identifies threats from companies entering from
nearby markets, substitutes, platform encroachment, and emerging startups.
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


class AdjacentThreatAgent(BaseAgent):
    name = "AdjacentThreatAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        """
        Main entry point. Flow:
        1. Collect sources about adjacent market players and platform threats
        2. Scrape key pages for deeper context
        3. Extract threat signals
        4. Build grounded findings
        5. Generate artifacts (threat_map, category_overlap)
        6. Return structured AgentOutput
        """
        errors: list[str] = []
        evidence: list[Evidence] = []

        # Step 1 & 2: collect sources
        sources = await self.collect_sources(query, errors)

        # Step 3: convert to evidence
        for src in sources:
            evidence.append(Evidence(
                source_type=src.get("source_type", "web_search"),
                url=src.get("url", ""),
                title=src.get("title", ""),
                snippet=src.get("snippet", ""),
                collected_at=src.get("collected_at", datetime.now(timezone.utc).isoformat()),
                entity=src.get("entity", query.company_name or ""),
            ))

        # Step 4: extract threat signals
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
        """Gather data about adjacent threats, platform moves, and emerging startups."""
        company = query.company_name or query.product_name or "company"
        sources: list[dict] = []

        # Parallel searches targeting different threat vectors
        try:
            adjacent_results, platform_results, startup_results, reddit_posts, hn_stories = await asyncio.gather(
                search_web(f"{company} adjacent market entrants new competitors", num_results=3),
                search_web(f"{company} platform encroachment big tech bundling", num_results=3),
                search_web(f"{company} emerging startup substitute alternative", num_results=3),
                search_reddit(f"{company} new competitor platform threat", limit=3),
                search_hackernews(f"{company} disruption startup alternative", limit=3),
            )
        except Exception as e:
            errors.append(f"Source collection failed: {str(e)}")
            return sources

        # Tag by threat vector
        for r in adjacent_results:
            r["source_type"] = "adjacent_market_search"
            r["entity"] = company
            sources.append(r)

        for r in platform_results:
            r["source_type"] = "platform_threat_search"
            r["entity"] = company
            sources.append(r)

        for r in startup_results:
            r["source_type"] = "emerging_startup_search"
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

        # Scrape top results for deeper context
        urls_to_scrape = [r["url"] for r in (adjacent_results + platform_results)[:3]]
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
        """Parse sources for adjacent threat signal categories."""
        signals = {
            "adjacent_entrants": [],
            "substitutes": [],
            "platform_encroachment": [],
            "emerging_startups": [],
            "category_expansion": [],
        }

        for src in sources:
            text = (src.get("snippet", "") + " " + src.get("title", "")).lower()

            # Adjacent market entrants
            if any(kw in text for kw in ["entering", "expanding into", "adjacent", "new competitor", "pivot"]):
                signals["adjacent_entrants"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                    "threat_level": "high" if any(kw in text for kw in ["major", "big", "established"]) else "medium",
                })

            # Substitutes
            if any(kw in text for kw in ["substitute", "alternative", "replacement", "switched", "instead of"]):
                signals["substitutes"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Platform encroachment (big tech building native features)
            if any(kw in text for kw in ["platform", "native", "built-in", "bundl", "embedded", "big tech"]):
                signals["platform_encroachment"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                    "threat_level": "high" if any(kw in text for kw in ["native", "built-in", "bundl"]) else "medium",
                })

            # Emerging startups
            if any(kw in text for kw in ["startup", "seed", "series a", "early-stage", "new entrant", "founded", "show hn"]):
                signals["emerging_startups"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

            # Category expansion (companies broadening scope into your space)
            if any(kw in text for kw in ["expand", "broader", "category", "all-in-one", "suite", "consolidat"]):
                signals["category_expansion"].append({
                    "signal": src.get("snippet", ""),
                    "source": src.get("url", ""),
                })

        return signals

    def generate_findings(self, signals: dict, query: QueryRequest) -> list[Finding]:
        """Convert threat signals into structured Finding objects."""
        findings: list[Finding] = []
        company = query.company_name or query.product_name or "the company"

        # Adjacent entrant findings
        if signals["adjacent_entrants"]:
            high_threat = sum(1 for e in signals["adjacent_entrants"] if e.get("threat_level") == "high")
            findings.append(Finding(
                statement=f"Detected {len(signals['adjacent_entrants'])} adjacent market entrants targeting {company}'s space ({high_threat} high-threat).",
                type="fact",
                confidence="high" if len(signals["adjacent_entrants"]) >= 2 else "medium",
                rationale=f"Cross-referenced web search and discussion sources for market entry signals.",
            ))

        # Platform encroachment findings
        if signals["platform_encroachment"]:
            high_threat = sum(1 for e in signals["platform_encroachment"] if e.get("threat_level") == "high")
            findings.append(Finding(
                statement=f"Platform encroachment detected — {len(signals['platform_encroachment'])} signals of large platforms building native capabilities that overlap with {company}.",
                type="fact",
                confidence="high" if high_threat > 0 else "medium",
                rationale=f"Detected platform bundling and native feature signals. {high_threat} rated high-threat.",
            ))

            if high_threat > 0:
                findings.append(Finding(
                    statement=f"Recommend deepening specialization and integration moats to defend against platform commoditization.",
                    type="recommendation",
                    confidence="medium",
                    rationale="Platform entrants have distribution advantage; specialization and switching costs are the primary defense.",
                ))

        # Substitute findings
        if signals["substitutes"]:
            findings.append(Finding(
                statement=f"Substitute products are being discussed as alternatives to {company} in community forums.",
                type="interpretation",
                confidence="medium" if len(signals["substitutes"]) >= 2 else "low",
                rationale=f"Found {len(signals['substitutes'])} substitute/alternative mentions.",
            ))

        # Emerging startup findings
        if signals["emerging_startups"]:
            findings.append(Finding(
                statement=f"Emerging startups are entering {company}'s category — {len(signals['emerging_startups'])} signals of new entrants detected.",
                type="fact",
                confidence="medium",
                rationale="Startup signals from funding news, Product Hunt, and Hacker News.",
            ))

        # Category expansion findings
        if signals["category_expansion"]:
            findings.append(Finding(
                statement=f"Category consolidation signals detected — vendors are expanding into adjacent features, increasing competitive overlap.",
                type="interpretation",
                confidence="medium" if len(signals["category_expansion"]) >= 2 else "low",
                rationale=f"Found {len(signals['category_expansion'])} category expansion signals.",
            ))

        if not findings:
            findings.append(Finding(
                statement=f"No strong adjacent threat signals detected for {company} at this time.",
                type="interpretation",
                confidence="low",
                rationale="Insufficient data from available sources to identify clear threats.",
            ))

        return findings

    def _generate_artifacts(self, signals: dict, query: QueryRequest) -> list[Artifact]:
        """Generate threat_map and category_overlap artifacts."""
        company = query.company_name or query.product_name or "target company"

        # Threat map — overview of all threat vectors
        threat_map = {
            "company": company,
            "threat_vectors": {
                "adjacent_entrants": {
                    "count": len(signals["adjacent_entrants"]),
                    "high_threat_count": sum(1 for e in signals["adjacent_entrants"] if e.get("threat_level") == "high"),
                    "signals": [s.get("signal", "")[:200] for s in signals["adjacent_entrants"][:3]],
                },
                "platform_encroachment": {
                    "count": len(signals["platform_encroachment"]),
                    "high_threat_count": sum(1 for e in signals["platform_encroachment"] if e.get("threat_level") == "high"),
                    "signals": [s.get("signal", "")[:200] for s in signals["platform_encroachment"][:3]],
                },
                "substitutes": {
                    "count": len(signals["substitutes"]),
                    "signals": [s.get("signal", "")[:200] for s in signals["substitutes"][:3]],
                },
                "emerging_startups": {
                    "count": len(signals["emerging_startups"]),
                    "signals": [s.get("signal", "")[:200] for s in signals["emerging_startups"][:3]],
                },
            },
            "overall_threat_level": self._assess_overall_threat(signals),
        }

        # Category overlap — where adjacent players overlap
        category_overlap = {
            "company": company,
            "expansion_signals": [
                {"signal": s.get("signal", "")[:200], "source": s.get("source", "")}
                for s in signals["category_expansion"][:5]
            ],
            "adjacent_entry_signals": [
                {"signal": s.get("signal", "")[:200], "source": s.get("source", "")}
                for s in signals["adjacent_entrants"][:5]
            ],
            "total_overlap_signals": len(signals["category_expansion"]) + len(signals["adjacent_entrants"]),
        }

        return [
            Artifact(artifact_type="threat_map", payload=threat_map),
            Artifact(artifact_type="category_overlap", payload=category_overlap),
        ]

    def _assess_overall_threat(self, signals: dict) -> str:
        """Compute an overall threat level based on signal counts and severity."""
        high_threats = (
            sum(1 for e in signals["adjacent_entrants"] if e.get("threat_level") == "high")
            + sum(1 for e in signals["platform_encroachment"] if e.get("threat_level") == "high")
        )
        total_signals = sum(len(v) for v in signals.values())

        if high_threats >= 2 or total_signals >= 10:
            return "high"
        elif high_threats >= 1 or total_signals >= 5:
            return "medium"
        return "low"
