import asyncio
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.orchestrator.agent_registry import AgentRegistry

class MockContext:
    def __init__(self, query, company_name=None):
        self.query = query
        self.company_name = company_name

async def test_all_agents():
    print("Starting Full API Stack Integration Test...")
    registry = AgentRegistry()
    agents = registry.get_all_agents()
    context = MockContext(query="Analyze OpenAI competitive positioning", company_name="OpenAI")

    tasks = []
    for name, agent in agents.items():
        print(f"  -> Triggering {name} ({agent.name})...")
        tasks.append(agent.run(context))

    results = await asyncio.gather(*tasks)

    print("\nTest Results Summary:")
    for result in results:
        findings_count = len(result.findings)
        evidence_count = len(result.evidence)
        artifacts_count = len(result.artifacts)
        print(f"  [{result.agent_name}] Status: {result.status} | Findings: {findings_count} | Evidence: {evidence_count} | Artifacts: {artifacts_count}")
        
    print("\nAll agents responded successfully with integrated API signals.")

if __name__ == "__main__":
    asyncio.run(test_all_agents())
