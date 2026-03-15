"""
PositioningAgent — analyzes messaging, differentiation, category framing,
and identifies positioning gaps by comparing competitor homepage copy.
"""

import asyncio
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput, Evidence, Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest
from tools.search_tools import search_web
from tools.scraper_tools import extract_page_sections
from tools.signal_extractors import detect_positioning_signals


class PositioningAgent(BaseAgent):
    name = "PositioningAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        company = query.company_name or "the target company"
        evidence: list[Evidence] = []
        positioning_data: dict[str, dict] = {}
        errors: list[str] = []

        try:
            sources = await self._collect_sources(company, query.query)
            scraped = await self._scrape_sources(sources)

            for page in scraped:
                text = page.get("text", "")
                hero = page.get("sections", {}).get("hero", "")
                if not text:
                    continue

                # Analyze both hero and full text
                analysis = detect_positioning_signals(hero or text)
                entity = self._infer_entity(page.get("url", ""), page.get("title", ""), company)
                positioning_data[entity] = {
                    "claims": analysis["claims"],
                    "overused": analysis["overused_phrases"],
                    "icp_hints": analysis["icp_hints"],
                    "hero_snippet": (hero or text)[:200],
                }
                evidence.append(Evidence(
                    source_type="website",
                    url=page.get("url", ""),
                    title=page.get("title", ""),
                    snippet=(hero or text)[:300],
                    collected_at=page.get("collected_at", datetime.now(timezone.utc).isoformat()),
                ))
        except Exception as e:
            errors.append(f"Positioning research failed: {e}")

        findings = self._generate_findings(positioning_data, company)
        artifacts = self._build_artifacts(positioning_data)

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
            search_web(f"{company} homepage"),
            search_web(f"{company} competitors homepage messaging"),
            search_web(f"{company} product features tagline"),
            return_exceptions=True,
        )
        sources = []
        for result in searches:
            if isinstance(result, list):
                sources.extend(result)
        return sources

    async def _scrape_sources(self, sources: list[dict]) -> list[dict]:
        tasks = []
        for src in sources[:6]:
            url = src.get("url", "")
            if url:
                tasks.append(self._scrape_one(src))
        if not tasks:
            return []
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r for r in results if isinstance(r, dict) and r.get("text")]

    async def _scrape_one(self, source: dict) -> dict:
        page = await extract_page_sections(source["url"])
        if not page.get("text") and source.get("snippet"):
            page["text"] = source["snippet"]
            page["title"] = source.get("title", "")
            page["sections"] = {"hero": source["snippet"]}
        return page

    def _infer_entity(self, url: str, title: str, default: str) -> str:
        if "://" in url:
            domain = url.split("://")[1].split("/")[0].replace("www.", "").split(".")[0]
            if domain and domain not in ("g2", "capterra", "trustradius", "reddit", "google"):
                return domain
        return default

    def _generate_findings(self, data: dict[str, dict], company: str) -> list[Finding]:
        if not data:
            return [Finding(
                statement=f"No positioning data found for {company}.",
                type="interpretation",
                confidence="low",
                rationale="Could not scrape or analyze any competitor pages.",
            )]

        findings: list[Finding] = []

        # Per-entity messaging analysis
        for entity, info in data.items():
            claims = info.get("claims", {})
            overused = info.get("overused", [])
            icp = info.get("icp_hints", [])

            if claims:
                top_claims = sorted(claims.items(), key=lambda x: -x[1])[:3]
                claim_summary = ", ".join(c[0].replace("_claim", "") for c in top_claims)
                findings.append(Finding(
                    statement=f"{entity}'s messaging emphasizes: {claim_summary}.",
                    type="fact",
                    confidence="medium",
                    rationale=f"Detected from homepage/product page copy analysis.",
                ))

            if overused:
                findings.append(Finding(
                    statement=f"{entity} uses overused phrases: {', '.join(overused[:3])}.",
                    type="interpretation",
                    confidence="medium",
                    rationale="These phrases are common across SaaS and may dilute differentiation.",
                ))

            if icp:
                findings.append(Finding(
                    statement=f"{entity} appears to target: {', '.join(icp)}.",
                    type="interpretation",
                    confidence="low",
                    rationale="Inferred from language patterns on their site.",
                ))

        # Cross-entity gap analysis
        if len(data) >= 2:
            all_claims: dict[str, int] = {}
            for info in data.values():
                for claim, count in info.get("claims", {}).items():
                    all_claims[claim] = all_claims.get(claim, 0) + 1

            saturated = [c for c, n in all_claims.items() if n >= 2]
            if saturated:
                findings.append(Finding(
                    statement=f"Saturated claims across competitors: {', '.join(c.replace('_claim', '') for c in saturated)}.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Multiple competitors making the same core claims reduces differentiation.",
                ))

            # Whitespace: claims NOT made by the target company
            company_key = None
            for key in data:
                if company.lower() in key.lower():
                    company_key = key
                    break
            if company_key:
                company_claims = set(data[company_key].get("claims", {}).keys())
                competitor_claims = set()
                for key, info in data.items():
                    if key != company_key:
                        competitor_claims.update(info.get("claims", {}).keys())
                gaps = competitor_claims - company_claims
                if gaps:
                    findings.append(Finding(
                        statement=f"Positioning gap: {company} does not emphasize {', '.join(g.replace('_claim', '') for g in gaps)} unlike competitors.",
                        type="recommendation",
                        confidence="medium",
                        rationale="Competitors claim these areas; could be a differentiation opportunity or gap.",
                    ))

        return findings

    def _build_artifacts(self, data: dict[str, dict]) -> list[Artifact]:
        if not data:
            return []

        # Message gap heatmap: entity -> claim presence
        all_claim_types = set()
        for info in data.values():
            all_claim_types.update(info.get("claims", {}).keys())

        heatmap = {}
        for entity, info in data.items():
            entity_claims = info.get("claims", {})
            heatmap[entity] = {
                claim: entity_claims.get(claim, 0) for claim in sorted(all_claim_types)
            }

        # Positioning summary
        summary = {}
        for entity, info in data.items():
            summary[entity] = {
                "top_claims": sorted(info.get("claims", {}).items(), key=lambda x: -x[1])[:3],
                "overused_phrases": info.get("overused", []),
                "icp_hints": info.get("icp_hints", []),
                "hero_snippet": info.get("hero_snippet", ""),
            }

        return [
            Artifact(artifact_type="message_gap_heatmap", payload=heatmap),
            Artifact(artifact_type="positioning_summary", payload=summary),
        ]
