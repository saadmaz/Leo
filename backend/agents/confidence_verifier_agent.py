from typing import List, Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest
import json

class ConfidenceVerifierAgent(BaseAgent):
    def __init__(self):
        super().__init__("verifier")

    async def run(self, query_context: QueryRequest, all_agent_outputs: List[AgentOutput]) -> List[AgentOutput]:
        """
        Verify findings by cross-referencing evidence and checking for contradictions.
        """
        # Collect all findings for verification
        findings_to_verify = []
        for out in all_agent_outputs:
            for f in out.findings:
                findings_to_verify.append({
                    "agentId": out.agentId,
                    "claim": f.claim,
                    "confidence": f.confidence,
                    "isFactual": f.isFactual,
                    "sourceIds": f.sourceIds,
                    "rationale": f.rationale,
                    "domain": f.domain
                })

        system_prompt = """
You are a specialist CONFIDENCE VERIFIER for a multi-agent growth intelligence system ("Leo").
Your job is to look at findings from 6 specialist agents and:
1. Identify contradictions (e.g., one agent says growth is up, another says down).
2. Flag claims that seem like hallucinations or have weak logic.
3. Downgrade confidence if a claim is not backed by specific sourceIds.
4. Output a list of "adjustments" to be applied.

Return ONLY JSON matching the following structure:
{
  "adjustments": [
    {
      "claim": "The exact original claim",
      "newConfidence": "high/medium/low",
      "isFactual": true/false,
      "verificationNote": "Short reason for change"
    }
  ]
}
"""
        user_prompt = f"Product: {query_context.product}\nFindings to Verify: {json.dumps(findings_to_verify)}"
        
        try:
            # We use chat_with_llm (which should handle JSON parsing)
            # Use self.llm.analyze_data as a shortcut if we just want a JSON result
            verification_results = await self.llm.analyze_data(findings_to_verify, system_prompt)
            adjustments = verification_results.get("adjustments", [])
            
            # Map adjustments back to the agent_outputs
            adj_map = {adj["claim"]: adj for adj in adjustments}
            
            for out in all_agent_outputs:
                for f in out.findings:
                    if f.claim in adj_map:
                        adj = adj_map[f.claim]
                        f.confidence = adj.get("newConfidence", f.confidence)
                        f.isFactual = adj.get("isFactual", f.isFactual)
                        # Optionally add the note to interpretations or similar if we had a place
            
            return all_agent_outputs
        except Exception as e:
            print(f"ERROR: [ConfidenceVerifierAgent] {e}")
            return all_agent_outputs
