import asyncio
from datetime import datetime
from typing import List, Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.hiring_tools import search_hiring_signals, get_hiring_velocity

from backend.schemas.query_schema import QueryRequest
from backend.schemas.source_schema import Source

class HiringSignalAgent(BaseAgent):
    def __init__(self):
        super().__init__("hiring_signal")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        
        # 1. Company Specific Velocity
        # Assuming these tools return compatible data for a hackathon
        velocity = await get_hiring_velocity(product)
        
        findings = []
        sources = []
        facts = []
        interpretations = []

        if velocity.get("total_open_roles", 0) > 0:
            finding_id = f"f-hiring-{product}"
            findings.append(Finding(
                id=finding_id,
                claim=f"{product} is actively hiring for {velocity['total_open_roles']} roles.",
                confidence="high",
                rationale="Direct job postings counts.",
                domain="Hiring",
                sourceIds=["s1"],
                isFactual=True
            ))
            facts.append(f"{product} has {velocity['total_open_roles']} open job listings.")
            sources.append(Source(id="s1", url="https://adzuna.com", title="Adzuna Job Search", snippet="Market data for hiring patterns."))

        return AgentOutput(
            agentId="hiring_signal",
            confidence="high",
            findings=findings,
            sources=sources,
            facts=facts,
            interpretations=interpretations,
            errors=[]
        )
