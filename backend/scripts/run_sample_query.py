import asyncio
import json
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.orchestrator.orchestrator import Orchestrator
from backend.schemas.query_schema import QueryRequest

async def main():
    orchestrator = Orchestrator()
    
    sample_request = QueryRequest(
        query="Is Vector competitive in the AI SDR market right now?",
        company_name="Vector Agents",
        product_name="Vector",
        session_id="demo-session-1",
        context={}
    )
    
    print("\n🚀 Starting Multi-Agent Analysis...\n")
    response = await orchestrator.run(sample_request)
    
    print("✅ Analysis Complete!\n")
    print("--- EXECUTIVE SUMMARY ---")
    print(response.executive_summary)
    print("\n--- AGENT OUTPUTS (Statuses) ---")
    for out in response.agent_outputs:
        print(f"📡 {out.agent_name}: {out.status}")
        
    print("\n--- FINDINGS (Sample) ---")
    for finding in response.key_findings[:5]:
        print(f"- [{finding.type}] {finding.statement} (Confidence: {finding.confidence})")
    
    print("\n--- RECOMMENDATIONS ---")
    for rec in response.recommendations:
        print(f"👉 {rec.statement}")

if __name__ == "__main__":
    asyncio.run(main())
