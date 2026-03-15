"""
WinLossAgent — identifies buyer complaints, objections, switching reasons,
and friction points from public sources (reviews, Reddit, HN, forums).
"""

import asyncio
from collections import Counter
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput, Evidence, Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest
from tools.search_tools import search_web, search_reddit, search_hackernews
from tools.scraper_tools import scrape_page
from tools.signal_extractors import detect_review_signals


class WinLossAgent(BaseAgent):
    name = "WinLossAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        company = query.company_name or "the target company"
        evidence: list[Evidence] = []
        all_signals: list[dict] = []
        errors: list[str] = []

        try:
            sources = await self._collect_sources(company, query.query)
            scraped = await self._scrape_sources(sources)
            for page in scraped:
                if not page.get("text"):
                    continue
                signals = detect_review_signals(page["text"])
                if signals:
                    all_signals.extend(signals)
                    evidence.append(Evidence(
                        source_type=page.get("source_type", "web"),
                        url=page.get("url", ""),
                        title=page.get("title", ""),
                        snippet=page["text"][:300],
                        collected_at=page.get("collected_at", datetime.now(timezone.utc).isoformat()),
                    ))
        except Exception as e:
            errors.append(f"Source collection failed: {e}")

        findings = self._generate_findings(all_signals, company)
        artifacts = self._build_artifacts(all_signals)

        return AgentOutput(
            agent_name=self.name,
            status="success" if findings else "error",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=errors,
        )

    async def _collect_sources(self, company: str, query: str) -> list[dict]:
        """Gather search results from multiple channels in parallel."""
        searches = await asyncio.gather(
            search_web(f"{company} review complaints problems"),
            search_web(f"{company} vs competitors switched from"),
            search_reddit(f"{company} complaints issues problems"),
            search_hackernews(f"{company} alternative"),
            return_exceptions=True,
        )
        sources = []
        for result in searches:
            if isinstance(result, list):
                sources.extend(result)
        return sources

    async def _scrape_sources(self, sources: list[dict]) -> list[dict]:
        """Scrape content from collected URLs."""
        tasks = []
        for src in sources[:8]:  # cap to avoid excessive scraping
            url = src.get("url", "")
            if url:
                tasks.append(self._scrape_one(src))
        if not tasks:
            return []
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, dict) and r.get("text")]

    async def _scrape_one(self, source: dict) -> dict:
        page = await scrape_page(source["url"])
        page["source_type"] = source.get("source_type", "web")
        # If scrape failed, fall back to the search snippet
        if not page.get("text") and source.get("snippet"):
            page["text"] = source["snippet"]
            page["title"] = source.get("title", "")
        return page

    def _generate_findings(self, signals: list[dict], company: str) -> list[Finding]:
        if not signals:
            return [Finding(
                statement=f"No clear win/loss signals found for {company} from public sources.",
                type="interpretation",
                confidence="low",
                rationale="Insufficient public data to identify patterns.",
            )]

        signal_counts = Counter(s["signal"] for s in signals)
        findings: list[Finding] = []

        # Top objections
        for signal_type, count in signal_counts.most_common(5):
            label = signal_type.replace("_", " ")
            confidence = "high" if count >= 3 else "medium" if count >= 2 else "low"
            example = next((s for s in signals if s["signal"] == signal_type), {})

            findings.append(Finding(
                statement=f"Recurring buyer pain: '{label}' detected in {count} source(s).",
                type="fact",
                confidence=confidence,
                rationale=f"Matched pattern in public content. Example context: {example.get('context', 'N/A')}",
            ))

        # Switching signals
        switching = [s for s in signals if s["signal"] == "switching"]
        if switching:
            findings.append(Finding(
                statement=f"Switching language detected — buyers are moving to/from {company}.",
                type="interpretation",
                confidence="medium" if len(switching) >= 2 else "low",
                rationale=f"Found {len(switching)} switching mention(s) in public discussions.",
            ))

        return findings

    def _build_artifacts(self, signals: list[dict]) -> list[Artifact]:
        if not signals:
            return []

        signal_counts = Counter(s["signal"] for s in signals)

        objection_map = {
            signal_type.replace("_", " "): {
                "count": count,
                "examples": [
                    s.get("context", "") for s in signals if s["signal"] == signal_type
                ][:3],
            }
            for signal_type, count in signal_counts.most_common()
        }

        # Cluster into categories
        pain_categories = {
            "cost": ["too_expensive", "weak_roi"],
            "reliability": ["unreliable"],
            "usability": ["bad_onboarding", "setup_complexity"],
            "support": ["poor_support"],
            "features": ["missing_integrations"],
            "churn": ["switching"],
        }
        clusters = {}
        for category, signal_types in pain_categories.items():
            total = sum(signal_counts.get(st, 0) for st in signal_types)
            if total > 0:
                clusters[category] = total

        return [
            Artifact(artifact_type="objection_map", payload=objection_map),
            Artifact(artifact_type="buyer_pain_clusters", payload=clusters),
        ]
