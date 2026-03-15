from fastapi import APIRouter, HTTPException

from schemas.query_schema import QueryRequest, OrchestratorResponse
from orchestrator.orchestrator import Orchestrator
from orchestrator.agent_registry import AgentRegistry
from memory.memory_manager import MemoryManager
from agents.specialist_agents import (
    PricingAgent,
    CompetitiveLandscapeAgent,
    MarketTrendsAgent,
    PositioningAgent,
    WinLossAgent,
    AdjacentThreatAgent,
)

router = APIRouter()

# ── Bootstrap registry, memory, and orchestrator ───────────────
memory = MemoryManager()
registry = AgentRegistry()

registry.register(PricingAgent(), keywords=["pricing", "price", "cost", "plan"])
registry.register(CompetitiveLandscapeAgent(), keywords=["competitor", "competition", "competitive", "versus", "vs"])
registry.register(MarketTrendsAgent(), keywords=["market", "trend", "industry", "growth"])
registry.register(PositioningAgent(), keywords=["positioning", "messaging", "brand", "narrative"])
registry.register(WinLossAgent(), keywords=["loss", "win", "customer", "churn", "deal"])
registry.register(AdjacentThreatAgent(), keywords=["adjacent", "disruption", "threat", "entrant"])

orchestrator = Orchestrator(registry=registry, memory=memory)


@router.post("/query", response_model=OrchestratorResponse)
async def handle_query(request: QueryRequest) -> OrchestratorResponse:
    try:
        result = await orchestrator.run(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
