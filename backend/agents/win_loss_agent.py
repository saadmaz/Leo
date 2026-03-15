import asyncio
from datetime import datetime
from .base_agent import BaseAgent
from ..schemas.agent_output import AgentOutput
from ..schemas.finding_schema import Finding
from ..schemas.evidence_schema import Evidence
from ..schemas.artifact_schema import Artifact
from ..tools.search_tools import search_reddit

class WinLossAgent(BaseAgent):
    def __init__(self):
        super().__init__("WinLossAgent")

    async def run(self, query_context) -> AgentOutput:
        raw_reddit = await search_reddit(f"{query_context.company_name} reviews")
        
        findings = [
            Finding(
                id="wl-1",
                statement="Users frequently mention setup complexity as a friction point.",
                type="fact",
                confidence="high",
                rationale="Multiple reddit threads discuss implementation hurdles.",
                domain="Customer Voice",
                evidence_ids=["ev-4"]
            )
        ]
        
        evidence = [
            Evidence(
                id="ev-4",
                source_type="social",
                url=raw_reddit[0]["url"],
                title=raw_reddit[0]["title"],
                snippet=raw_reddit[0]["snippet"],
                collected_at=datetime.now(),
                entity=query_context.company_name or "Product",
                tags=["friction", "onboarding"]
            )
        ]
        
        artifacts = [
            Artifact(
                artifact_type="objection_map",
                title="Common Buyer Objections",
                payload={"Technical": ["Complex Setup"], "Pricing": ["High Entry Cost"]}
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
