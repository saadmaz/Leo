import pytest
import asyncio
from backend.agents.market_trends_agent import MarketTrendsAgent
from backend.schemas.query_schema import QueryRequest

@pytest.mark.asyncio
async def test_market_trends_agent():
    agent = MarketTrendsAgent()
    query = QueryRequest(query="test", session_id="test-session", context={})
    output = await agent.run(query)
    
    assert output.agent_name == "MarketTrendsAgent"
    assert output.status == "success"
    assert len(output.findings) > 0
    assert len(output.evidence) > 0

@pytest.mark.asyncio
async def test_agent_error_handling():
    # Mock an agent that fails
    class FailingAgent:
        name = "FailingAgent"
        async def run(self, q): raise Exception("Simulated failure")
        
    from backend.orchestrator.orchestrator import Orchestrator
    orchestrator = Orchestrator()
    # Replace one agent with a failing one in registry if needed, 
    # but orchestrator._safe_run handles generic objects with .run()
    res = await orchestrator._safe_run(FailingAgent(), None)
    assert res.status == "failed"
    assert "Simulated failure" in res.errors[0]
