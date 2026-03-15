import pytest
from backend.orchestrator.orchestrator import Orchestrator
from backend.schemas.query_schema import QueryRequest

@pytest.mark.asyncio
async def test_orchestrator_full_flow():
    orchestrator = Orchestrator()
    query = QueryRequest(
        query="Is Vector competitive?",
        company_name="Vector",
        session_id="test-session",
        context={}
    )
    
    response = await orchestrator.run(query)
    
    assert response.executive_summary is not None
    assert len(response.findings) > 0
    assert "market_trends" in response.agent_statuses
    assert response.agent_statuses["market_trends"] == "success"
