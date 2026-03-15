import asyncio
import traceback

from orchestrator.agent_registry import AgentRegistry
from agents.confidence_agent import ConfidenceAgent
from agents.synthesizer_agent import SynthesizerAgent
from memory.memory_manager import MemoryManager
from schemas.agent_output import AgentOutput
from schemas.query_schema import QueryRequest, OrchestratorResponse

AGENT_TIMEOUT_SECONDS = 15


class Orchestrator:
    """
    Core orchestration engine.

    Pipeline:
        1. Agent selection  – pick relevant specialists based on query keywords
        2. Parallel execution – run selected agents concurrently (with timeout)
        3. Result collection – gather successes and capture failures
        4. Confidence processing – score outputs via ConfidenceAgent
        5. Synthesis – merge results via SynthesizerAgent
        6. Memory update – store session context for follow-ups
    """

    def __init__(self, registry: AgentRegistry, memory: MemoryManager) -> None:
        self.registry = registry
        self.memory = memory
        self.confidence_agent = ConfidenceAgent()
        self.synthesizer_agent = SynthesizerAgent()

    async def run(self, request: QueryRequest) -> OrchestratorResponse:
        # ── 1. Agent selection ──────────────────────────────────────
        selected_agents = self.registry.resolve_agents(request.query)
        agent_names = [a.name for a in selected_agents]

        # Retrieve prior context for follow-up enrichment
        prior_context = self.memory.get_context(request.session_id)
        if prior_context and request.context is None:
            request.context = prior_context.get("last_summary", "")

        # ── 2. Parallel execution ──────────────────────────────────
        tasks = [
            asyncio.wait_for(agent.run(request), timeout=AGENT_TIMEOUT_SECONDS)
            for agent in selected_agents
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # ── 3. Result collection ───────────────────────────────────
        successful_outputs: list[AgentOutput] = []
        errors: list[str] = []

        for agent, result in zip(selected_agents, raw_results):
            if isinstance(result, Exception):
                error_msg = f"{agent.name}: {type(result).__name__} – {result}"
                errors.append(error_msg)
                successful_outputs.append(
                    AgentOutput(agent_name=agent.name, status="error", errors=[str(result)])
                )
            else:
                successful_outputs.append(result)

        # ── 4. Confidence processing ───────────────────────────────
        confidence_overview = self.confidence_agent.score_outputs(successful_outputs)

        # ── 5. Synthesis ───────────────────────────────────────────
        synthesis = self.synthesizer_agent.synthesize(
            query=request,
            outputs=successful_outputs,
            confidence_overview=confidence_overview,
        )

        # ── 6. Memory update ──────────────────────────────────────
        self.memory.store(
            session_id=request.session_id,
            query=request.query,
            summary=synthesis["executive_summary"],
        )

        return OrchestratorResponse(
            session_id=request.session_id,
            query=request.query,
            executive_summary=synthesis["executive_summary"],
            key_findings=synthesis["key_findings"],
            facts=synthesis["facts"],
            interpretations=synthesis["interpretations"],
            recommendations=synthesis["recommendations"],
            confidence_overview=synthesis["confidence_overview"],
            artifacts=synthesis["artifacts"],
            follow_up_questions=synthesis["follow_up_questions"],
            agent_outputs=[o.model_dump() for o in successful_outputs],
            errors=errors,
        )
