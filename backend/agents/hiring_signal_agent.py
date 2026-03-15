import asyncio
from datetime import datetime
from .base_agent import BaseAgent
from ..schemas.agent_output import AgentOutput
from ..schemas.finding_schema import Finding
from ..schemas.evidence_schema import Evidence
from ..schemas.artifact_schema import Artifact
from ..tools.hiring_tools import search_hiring_signals

class HiringSignalAgent(BaseAgent):
    def __init__(self):
        super().__init__("HiringSignalAgent")

    async def run(self, query_context) -> AgentOutput:
        # 1. Collect sources
        hiring_results = await search_hiring_signals(query_context.company_name or query_context.query)
        
        # 2. Extract signals & 3. Generate findings
        findings = []
        evidence = []
        
        if hiring_results:
            findings.append(
                Finding(
                    id="hiring-1",
                    statement=f"{query_context.company_name or 'The company'} is actively recruiting for technical and leadership roles, suggesting expansion.",
                    type="signal",
                    confidence="medium",
                    rationale="Detected multiple new job postings in specialized domains.",
                    domain="Hiring",
                    evidence_ids=[f"ev-hiring-{i}" for i in range(len(hiring_results))]
                )
            )
            
            for i, result in enumerate(hiring_results):
                evidence.append(
                    Evidence(
                        id=f"ev-hiring-{i}",
                        source_type="hiring_board",
                        url="#",  # Placeholder for real job link
                        title=f"{result['title']} at {result['company']}",
                        snippet=result['description'],
                        collected_at=datetime.now(),
                        entity=result['company'],
                        tags=["hiring", "expansion"]
                    )
                )

        # 4. Build artifacts
        artifacts = [
            Artifact(
                artifact_type="hiring_map",
                title="Active Recruitment Signals",
                payload={"roles": [r['title'] for r in hiring_results]}
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
