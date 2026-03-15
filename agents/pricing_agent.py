"""
PricingAgent — analyzes pricing models and packaging approaches across
companies using public pricing pages, reviews, and search results.
"""

import asyncio
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput, Evidence, Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest
from tools.search_tools import search_web
from tools.scraper_tools import scrape_page
from tools.signal_extractors import detect_pricing_signals


class PricingAgent(BaseAgent):
    name = "PricingAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        company = query.company_name or "the target company"
        evidence: list[Evidence] = []
        all_signals: list[dict] = []
        pricing_profiles: dict[str, list[dict]] = {}
        errors: list[str] = []

        try:
            sources = await self._collect_sources(company, query.query)
            scraped = await self._scrape_sources(sources)

            for page in scraped:
                text = page.get("text", "")
                if not text:
                    continue
                signals = detect_pricing_signals(text)
                if signals:
                    url = page.get("url", "")
                    entity = self._infer_entity(url, page.get("title", ""), company)
                    pricing_profiles.setdefault(entity, []).extend(signals)
                    all_signals.extend(signals)
                    evidence.append(Evidence(
                        source_type="pricing_page",
                        url=url,
                        title=page.get("title", ""),
                        snippet=text[:300],
                        collected_at=page.get("collected_at", datetime.now(timezone.utc).isoformat()),
                    ))
        except Exception as e:
            errors.append(f"Pricing research failed: {e}")

        findings = self._generate_findings(all_signals, pricing_profiles, company)
        artifacts = self._build_artifacts(pricing_profiles)

        return AgentOutput(
            agent_name=self.name,
            status="success" if findings else "error",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=errors,
        )

    async def _collect_sources(self, company: str, query: str) -> list[dict]:
        searches = await asyncio.gather(
            search_web(f"{company} pricing plans"),
            search_web(f"{company} competitors pricing comparison"),
            search_web(f"{company} pricing review cost"),
            return_exceptions=True,
        )
        sources = []
        for result in searches:
            if isinstance(result, list):
                sources.extend(result)
        return sources

    async def _scrape_sources(self, sources: list[dict]) -> list[dict]:
        tasks = []
        for src in sources[:8]:
            url = src.get("url", "")
            if url:
                tasks.append(self._scrape_one(src))
        if not tasks:
            return []
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, dict) and r.get("text")]

    async def _scrape_one(self, source: dict) -> dict:
        page = await scrape_page(source["url"])
        if not page.get("text") and source.get("snippet"):
            page["text"] = source["snippet"]
            page["title"] = source.get("title", "")
        return page

    def _infer_entity(self, url: str, title: str, default: str) -> str:
        """Try to figure out which company/product a pricing page belongs to."""
        combined = (url + " " + title).lower()
        # Simple heuristic: use domain name
        if "://" in url:
            domain = url.split("://")[1].split("/")[0].replace("www.", "").split(".")[0]
            if domain and domain not in ("g2", "capterra", "trustradius", "reddit", "google"):
                return domain
        return default

    def _generate_findings(
        self,
        signals: list[dict],
        profiles: dict[str, list[dict]],
        company: str,
    ) -> list[Finding]:
        if not signals:
            return [Finding(
                statement=f"No pricing signals detected for {company} from public sources.",
                type="interpretation",
                confidence="low",
                rationale="Could not find or parse pricing information.",
            )]

        findings: list[Finding] = []
        seen_signals = set()

        for entity, entity_signals in profiles.items():
            signal_types = list({s["signal"] for s in entity_signals})
            seen_signals.update(signal_types)

            if "contact_sales" in signal_types and "tiered" not in signal_types:
                findings.append(Finding(
                    statement=f"{entity} appears to use enterprise-led custom pricing.",
                    type="fact",
                    confidence="medium",
                    rationale="Pricing page shows contact-sales signals with no self-serve tiers.",
                ))
            elif "tiered" in signal_types:
                extras = [s for s in signal_types if s != "tiered"]
                desc = f" with {', '.join(extras)}" if extras else ""
                findings.append(Finding(
                    statement=f"{entity} uses a tiered pricing model{desc}.",
                    type="fact",
                    confidence="high" if len(entity_signals) >= 3 else "medium",
                    rationale=f"Detected {len(entity_signals)} pricing signal(s) on their page.",
                ))
            else:
                findings.append(Finding(
                    statement=f"{entity} pricing shows signals: {', '.join(signal_types)}.",
                    type="fact",
                    confidence="medium",
                    rationale=f"Based on {len(entity_signals)} detected pricing pattern(s).",
                ))

        # Cross-entity interpretation
        if len(profiles) >= 2:
            all_types = set()
            for sigs in profiles.values():
                all_types.update(s["signal"] for s in sigs)
            if "free_trial" in all_types and "contact_sales" in all_types:
                findings.append(Finding(
                    statement="Market shows a mix of PLG (free trial/freemium) and sales-led motions.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Multiple pricing models detected across competitors.",
                ))

        return findings

    def _build_artifacts(self, profiles: dict[str, list[dict]]) -> list[Artifact]:
        if not profiles:
            return []

        # Pricing table: entity -> detected model signals
        pricing_table = {}
        for entity, signals in profiles.items():
            pricing_table[entity] = {
                "detected_models": list({s["signal"] for s in signals}),
                "signal_count": len(signals),
            }

        # Packaging comparison
        all_signal_types = set()
        for sigs in profiles.values():
            for s in sigs:
                all_signal_types.add(s["signal"])

        comparison = {}
        for signal_type in sorted(all_signal_types):
            comparison[signal_type] = [
                entity for entity, sigs in profiles.items()
                if any(s["signal"] == signal_type for s in sigs)
            ]

        return [
            Artifact(artifact_type="pricing_table", payload=pricing_table),
            Artifact(artifact_type="packaging_comparison", payload=comparison),
        ]
