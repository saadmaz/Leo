from typing import List, Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest
from backend.schemas.final_response import FinalResponse
import json

class SynthesizerAgent(BaseAgent):
    def __init__(self):
        super().__init__("SynthesizerAgent")

    async def run(self, query_context: QueryRequest, verified_outputs: List[AgentOutput]) -> FinalResponse:
        """
        Synthesize findings into a final executive brief.
        """
        # Prepare data for synthesis
        all_data = []
        for out in verified_outputs:
            all_data.append(out.model_dump())

        system_prompt = """
You are the master SYNTHESISER agent for "Leo".
Your job is to merge reports from 6 specialist agents into a boardroom-quality BRIEF.
 
Your output must match the FinalResponse schema:
- executiveSummary: A high-level narrative.
- topOpportunities: 3-5 high-conviction growth levers.
- topRisks: 3-5 strategic threats.
- recommendedBets: 2-3 specific actions the team should take.
- artifacts: Summary tables, market maps, or scorecards.
- confidenceOverview: { "overall": "high|medium|low", "byDomain": { "domain_name": "high|medium|low" } }
- followUpQuestions: 3 smart questions for the user to ask next.
 
Return ONLY valid JSON matching FinalResponse.
"""

        user_prompt = f"""
Query: {query_context.question}
Product: {query_context.product}
Domain: {query_context.domain}
Agent Reports: {json.dumps(all_data)}
 
Synthesize everything now.
"""

        try:
            result = await self.llm.analyze_data(all_data, system_prompt)
            
            # Ensure required fields are present and correctly typed
            result.setdefault("agentStatuses", [
                {"name": out.agentId, "status": "success", "duration": 0} 
                for out in verified_outputs
            ])
            result.setdefault("queryCostEstimate", "$0.42")
            
            # Consolidate findings, facts, interpretations, and evidence
            consolidated_findings = []
            consolidated_facts = []
            consolidated_interpretations = []
            consolidated_evidence = []
            
            for out in verified_outputs:
                consolidated_findings.extend(out.findings)
                consolidated_facts.extend(out.facts)
                consolidated_interpretations.extend(out.interpretations)
                consolidated_evidence.extend(out.sources)
            
            result["findings"] = result.get("findings", consolidated_findings)
            result["facts"] = result.get("facts", consolidated_facts)
            result["interpretations"] = result.get("interpretations", consolidated_interpretations)
            result["evidence"] = result.get("evidence", consolidated_evidence)
            
            # Default artifacts if missing
            result.setdefault("artifacts", [])
            
            # Ensure confidenceOverview is valid
            if "confidenceOverview" not in result or not isinstance(result["confidenceOverview"], dict):
                result["confidenceOverview"] = {
                    "overall": "medium",
                    "byDomain": {query_context.domain: "medium"}
                }

            return FinalResponse(**result)
        except Exception as e:
            print(f"ERROR: [SynthesizerAgent] {e}")
            return FinalResponse(
                executiveSummary=f"Error in synthesis: {str(e)}",
                topOpportunities=[],
                topRisks=[],
                recommendedBets=[],
                findings=[],
                facts=[],
                interpretations=[],
                evidence=[],
                artifacts=[],
                confidenceOverview={"overall": "low", "byDomain": {}},
                followUpQuestions=["Try again?"],
                agentStatuses=[],
                queryCostEstimate="$0.00"
            )
