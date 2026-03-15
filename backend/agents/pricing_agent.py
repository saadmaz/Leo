import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.signal_extractors import detect_pricing_signals
from backend.tools.scraper_tools import scrape_page
from backend.tools.search_tools import search_web

class PricingAgent(BaseAgent):
    def __init__(self):
        super().__init__("PricingAgent")

    async def run(self, query_context) -> AgentOutput:
        # Collect Pricing data
        search_query = f"{query_context.company_name or query_context.query} pricing"
        pages = await search_web(search_query)
        # In production, we would scrape the first few pages
        raw_scrapes = [{"url": p["url"], "content": p["snippet"]} for p in pages[:2]]
        
        # LLM Analysis
        llm_analysis = await self.analyze_with_llm(
            data={"scrapes": raw_scrapes}, 
            query=search_query, 
            context_type="Pricing Information"
        )
        
        raw_findings = llm_analysis.get("findings", [])
        findings = []
        evidence = []
        
        for i, f in enumerate(raw_findings):
            findings.append(
                Finding(
                    id=f"price-{i}",
                    statement=f.get("statement", ""),
                    type=f.get("type", "fact"),
                    confidence=f.get("confidence", "low"),
                    rationale=f.get("rationale", ""),
                    domain="Pricing",
                    evidence_ids=[f"ev-price-{i}"]
                )
            )
            
            source = pages[0] if pages else {"url": "#", "title": "Pricing Search"}
            evidence.append(
                Evidence(
                    id=f"ev-price-{i}",
                    source_type="web_scrape",
                    url=source["url"],
                    title=source["title"],
                    snippet=source["snippet"],
                    collected_at=datetime.now(),
                    entity=query_context.company_name or "Competitor",
                    tags=["pricing", "packaging"]
                )
            )
        
        artifacts = [
            Artifact(
                artifact_type="pricing_tier",
                title="Extracted Pricing Tiers",
                payload={"tiers": [f.get('statement') for f in raw_findings]}
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
