import asyncio
from typing import List
from .agent_registry import AgentRegistry
from ..agents.confidence_verifier_agent import ConfidenceVerifierAgent
from ..agents.synthesizer_agent import SynthesizerAgent
from ..schemas.query_schema import QueryRequest
from ..schemas.final_response import FinalResponse
from ..schemas.agent_output import AgentOutput

class Orchestrator:
    def __init__(self):
        self.registry = AgentRegistry()
        self.verifier = ConfidenceVerifierAgent()
        self.synthesizer = SynthesizerAgent()

    async def run(self, query: QueryRequest) -> FinalResponse:
        # 1. Select agents (In a hackathon, run all relevant ones)
        agents_to_run = self.registry.get_all_agents().values()
        
        # 2. Run concurrently
        tasks = [self._safe_run(agent, query) for agent in agents_to_run]
        agent_outputs: List[AgentOutput] = await asyncio.gather(*tasks)
        
        # 3. Verify confidence
        verified_output = await self.verifier.run(agent_outputs)
        
        # 4. Synthesize final response
        final_response = await self.synthesizer.run(verified_output, agent_outputs)
        
        return final_response

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
