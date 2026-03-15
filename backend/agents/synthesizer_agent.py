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
        
        # Fallback if synthesis is empty/missing keys (common in Heuristic mode)
        summary = synthesis.get("summary") or synthesis.get("executive_summary")
        if not summary and "findings" in synthesis:
            # Construct a basic summary from findings
            summary = "Summary generated via data aggregation. " + " ".join([f['statement'] for f in synthesis['findings'][:2]])
        
        return {
            "query": query_context.query,
            "company": query_context.company_name,
            "executive_summary": summary or "No summary available. Data collected but analysis skipped.",
            "strategic_pillars": [
                {"title": "Opportunities", "content": synthesis.get("opportunities") or ["Manual review of findings recommended."]},
                {"title": "Risks", "content": synthesis.get("risks") or ["Data indicates volatile signals; please verify manually."]},
                {"title": "Recommendations", "content": synthesis.get("recommendations") or ["Configure OpenAI API key for full strategic insight."]}
            ],
            "confidence_score": synthesis.get("confidence_score") or 0.5,
            "agent_contributions": [out.agent_name for out in verified_outputs]
        }
