import asyncio
from typing import List
from backend.orchestrator.agent_registry import AgentRegistry
from backend.agents.confidence_verifier_agent import ConfidenceVerifierAgent
from backend.agents.synthesizer_agent import SynthesizerAgent
from backend.schemas.query_schema import QueryRequest
from backend.schemas.final_response import FinalResponse
from backend.schemas.agent_output import AgentOutput

class Orchestrator:
    def __init__(self):
        self.registry = AgentRegistry()
        self.verifier = ConfidenceVerifierAgent()
        self.synthesizer = SynthesizerAgent()

    async def run(self, query: QueryRequest) -> FinalResponse:
        # 1. Select agents
        agents_to_run = self.registry.get_all_agents().values()
        
        # 2. Run concurrently
        tasks = [self._safe_run(agent, query) for agent in agents_to_run]
        agent_outputs: List[AgentOutput] = await asyncio.gather(*tasks)
        
        # 3. Verify confidence
        verified_outputs = await self.verifier.run(query, agent_outputs)
        
        # 4. Synthesize final response data
        synthesis_data = await self.synthesizer.run(query, verified_outputs)
        
        # 5. Wrap in FinalResponse schema
        return FinalResponse(
            session_id=query.session_id,
            query=query.query,
            executive_summary=synthesis_data.get("executive_summary", ""),
            key_findings=[f for out in verified_outputs for f in (out.findings or []) if f.confidence == "high"],
            facts=[f for out in verified_outputs for f in (out.findings or []) if f.type == "fact"],
            interpretations=[f for out in verified_outputs for f in (out.findings or []) if f.type == "interpretation"],
            recommendations=[f for out in verified_outputs for f in (out.findings or []) if f.type == "recommendation"],
            confidence_overview={
                "score": synthesis_data.get("confidence_score", 0.0),
                "rationale": "Confidence score calculated across all agent signals."
            },
            artifacts=[a for out in verified_outputs for a in (out.artifacts or [])],
            follow_up_questions=synthesis_data.get("follow_up_questions", []),
            agent_outputs=verified_outputs,
            errors=[err for out in verified_outputs for err in (out.errors or [])]
        )

    async def _safe_run(self, agent, query) -> AgentOutput:
        try:
            return await agent.run(query)
        except Exception as e:
            return AgentOutput(
                agent_name=agent.name,
                status="failed",
                findings=[],
                evidence=[],
                artifacts=[],
                errors=[str(e)]
            )
