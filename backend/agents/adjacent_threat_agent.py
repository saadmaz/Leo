import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact

from backend.tools.patent_tools import search_patents
from backend.tools.gdelt_tools import search_gdelt, get_trend_timeline

class AdjacentThreatAgent(BaseAgent):
    def __init__(self):
        super().__init__("AdjacentThreatAgent")

    async def run(self, query_context) -> AgentOutput:
        product = query_context.product_name or query_context.company_name or query_context.query
        category = query_context.context.get("category", product)

        # 1. Collect Patent data
        search_query = product
        
        # 2. Collect GDELT event data
        results = await asyncio.gather(
            search_patents(search_query),
            search_gdelt(f'"{product}" OR "{category}" adjacent market')
        )
        patents, gdelt_articles = results
        
        findings = []
        evidence = []
        artifacts = []

        # Patent Findings
        for i, p in enumerate(patents[:3]):
            ev_id = f"ev-patent-{p.get('patent_number')}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="patent",
                url=f"https://patents.google.com/patent/{p.get('patent_number')}",
                title=p.get("title", "Patent Signal"),
                snippet=p.get("abstract", ""),
                collected_at=datetime.utcnow(),
                entity="Adjacent Player",
                tags=["platform", "expansion"]
            ))
            findings.append(Finding(
                id=f"f-patent-{i}",
                statement=f"Detected R&D activity in '{category}': {p.get('title')}.",
                type="fact",
                confidence="high",
                rationale="Filing found in USPTO/Google Patents index.",
                domain="Threats",
                evidence_ids=[ev_id]
            ))

        # GDELT Global Signal
        for i, article in enumerate(gdelt_articles[:3]):
            ev_id = f"ev-gdelt-{i}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="gdelt",
                url=article.get("url"),
                title=article.get("title", "Global Market Move"),
                snippet=f"Detected global event related to {product}.",
                collected_at=datetime.utcnow(),
                entity=product,
                tags=["market_threat", "adjacent_move"]
            ))
            findings.append(Finding(
                id=f"f-gdelt-{i}",
                statement=f"Global signal detected for {product} adjacent market: {article.get('title')}.",
                type="interpretation",
                confidence="medium",
                rationale="Analyzed global event tracking data via GDELT Project.",
                domain="Threats",
                evidence_ids=[ev_id]
            ))

        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=[]
        )
