from typing import List
from ..schemas.agent_output import AgentOutput
from ..schemas.final_response import FinalResponse
from ..schemas.finding_schema import Finding

class SynthesizerAgent:
    def __init__(self):
        self.name = "SynthesizerAgent"

    async def run(self, verified_output: AgentOutput, original_outputs: List[AgentOutput]) -> FinalResponse:
        findings = verified_output.findings
        facts = [f for f in findings if f.type == "fact"]
        interpretations = [f for f in findings if f.type == "interpretation"]
        
        all_evidence = []
        for out in original_outputs:
            all_evidence.extend(out.evidence)
            
        all_artifacts = []
        for out in original_outputs:
            all_artifacts.extend(out.artifacts)
        all_artifacts.extend(verified_output.artifacts)
        
        agent_statuses = {out.agent_name: out.status for out in original_outputs}
        
        confidence_artifact = next((a for a in verified_output.artifacts if a.artifact_type == "confidence_overview"), None)
        confidence_overview = confidence_artifact.payload if confidence_artifact else {}

        return FinalResponse(
            executive_summary="The AI SDR market is rapidly evolving with a shift towards autonomous agents.",
            findings=findings,
            facts=facts,
            interpretations=interpretations,
            evidence=all_evidence,
            artifacts=all_artifacts,
            recommendations=[
                "Focus on 'Autonomous' messaging to differentiate from 'Automated' legacy tools.",
                "Streamline onboarding to reduce setup friction noted in community discussions."
            ],
            confidence_overview=confidence_overview,
            follow_up_questions=[
                "How does Vector's integration depth compare to Salesforce native tools?",
                "What is the specific churn rate for seat-based vs usage-based pricing?"
            ],
            agent_statuses=agent_statuses
        )
