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

    async def run(self, query: QueryRequest, status_callback=None) -> FinalResponse:
        # 1. Start agents
        agents_to_run = self.registry.get_all_agents().values()
        
        if status_callback:
            await status_callback({"status": "starting", "message": f"Orchestrating {len(agents_to_run)} specialized agents..."})

        # 2. Run concurrently
        tasks = [self._safe_run(agent, query, status_callback) for agent in agents_to_run]
        agent_outputs: List[AgentOutput] = await asyncio.gather(*tasks)
        
        # 3. Verify
        if status_callback:
            await status_callback({"status": "verifying", "message": "Cross-referencing findings for consistency..."})
        verified_outputs = await self.verifier.run(query, agent_outputs)
        
        # 4. Synthesize
        if status_callback:
            await status_callback({"status": "synthesizing", "message": "Synthesizing boardroom-quality brief..."})
        final_brief = await self.synthesizer.run(query, verified_outputs)
        
        return final_brief

    async def _safe_run(self, agent, query, status_callback) -> AgentOutput:
        if status_callback:
             await status_callback({
                 "agentId": agent.name, 
                 "status": "running", 
                 "message": f"{agent.name} is initializing analysis..."
             })
        try:
            res = await agent.run(query, status_callback=status_callback)
            if status_callback:
                await status_callback({"agentId": agent.name, "status": "completed", "confidence": res.confidence})
            return res
        except Exception as e:
            if status_callback:
                 await status_callback({"agentId": agent.name, "status": "failed", "error": str(e)})
            return AgentOutput(
                agentId=agent.name,
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
