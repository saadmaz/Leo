import asyncio
import os
import sys
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agents.market_trends_agent import MarketTrendsAgent
from backend.schemas.query_schema import QueryRequest

async def test_agent():
    print("🧪 Testing MarketTrendsAgent...")
    
    agent = MarketTrendsAgent()
    
    # Test context
    query_context = QueryRequest(
        query="Is Vector competitive in the AI SDR market right now?",
        company_name="Vector Agents",
        product_name="Vector",
        session_id="test-session",
        context={"category": "AI SDR tools"}
    )
    
    print(f"Running agent for product: {query_context.product_name}")
    
    try:
        output = await agent.run(query_context)
        
        print(f"\n✅ Agent Name: {output.agent_name}")
        print(f"✅ Status: {output.status}")
        
        if output.errors:
            print("\n--- Errors ---")
            for err in output.errors:
                print(f"❌ {err}")

        print("\n--- Findings ---")
        for finding in output.findings:
            print(f"- [{finding.type}] {finding.statement} (Confidence: {finding.confidence})")
            
        print("\n--- Evidence ---")
        for ev in output.evidence:
            print(f"- [{ev.source_type}] {ev.title} ({ev.url})")
            
        print("\n--- Artifacts ---")
        for art in output.artifacts:
            print(f"- [{art.artifact_type}] {art.title}")
            
    except Exception as e:
        print(f"❌ Error running agent: {e}")
        if hasattr(e, "errors"):
             print(f"Validation Errors: {e.errors()}")

if __name__ == "__main__":
    asyncio.run(test_agent())
