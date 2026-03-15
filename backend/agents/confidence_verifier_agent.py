from typing import List
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput

class ConfidenceVerifierAgent(BaseAgent):
    def __init__(self):
        super().__init__("ConfidenceVerifierAgent")

    async def run(self, query_context, all_agent_outputs: List[AgentOutput]) -> List[AgentOutput]:
        """
        Verify findings by cross-referencing evidence using LLM.
        """
        # Collect all findings and evidence for analysis
        total_data = []
        for output in all_agent_outputs:
            total_data.append({
                "agent": output.agent_name,
                "findings": [f.model_dump() for f in output.findings],
                "evidence": [e.model_dump() for e in output.evidence]
            })
            
        prompt = """
        Review the following findings and evidence from multiple intelligence agents.
        Detect any hallucinations, contradictions, or weak evidence.
        For each finding, assign a verified_confidence (low, medium, high) and a verification_note.
        Return a JSON object with a 'verifications' key containing a list of objects 
        mapping 'finding_id' to 'verified_confidence' and 'verification_note'.
        """
        
        verification_results = await self.llm.analyze_data(total_data, prompt)
        v_map = {res['finding_id']: res for res in verification_results.get("verifications", [])}
        
        # Update findings with verified confidence
        for output in all_agent_outputs:
            for finding in output.findings:
                if finding.id in v_map:
                    finding.confidence = v_map[finding.id].get("verified_confidence", finding.confidence)
                    finding.rationale += f" [Verified: {v_map[finding.id].get('verification_note', 'N/A')}]"
                    
        return all_agent_outputs
