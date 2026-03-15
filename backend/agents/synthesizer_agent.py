from typing import List, Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput

class SynthesizerAgent(BaseAgent):
    def __init__(self):
        super().__init__("SynthesizerAgent")

    async def run(self, query_context, verified_outputs: List[AgentOutput]) -> Dict[str, Any]:
        """
        Synthesize findings into a final executive summary using LLM.
        """
        # Prepare all findings for synthesis
        all_findings = []
        for out in verified_outputs:
            all_findings.extend([f.model_dump() for f in out.findings])
            
        prompt = f"""
        Synthesize the following market intelligence findings for {query_context.company_name or query_context.query}.
        Produce a boardroom-quality summary including:
        1. Executive Overiew (High-level narrative)
        2. Key Opportunities (Bullet points)
        3. Strategic Risks (Bullet points)
        4. Recommended Next Steps (Actionable items)
        
        Format the output as a JSON object with 'summary', 'opportunities', 'risks', and 'recommendations'.
        """
        
        synthesis = await self.llm.analyze_data(all_findings, prompt)
        
        return {
            "query": query_context.query,
            "company": query_context.company_name,
            "executive_summary": synthesis.get("summary", "No summary available."),
            "strategic_pillars": [
                {"title": "Opportunities", "content": synthesis.get("opportunities", [])},
                {"title": "Risks", "content": synthesis.get("risks", [])},
                {"title": "Recommendations", "content": synthesis.get("recommendations", [])}
            ],
            "confidence_score": 0.85,
            "agent_contributions": [out.agent_name for out in verified_outputs]
        }
