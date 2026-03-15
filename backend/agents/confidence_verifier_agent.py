from datetime import datetime
from ..agents.base_agent import BaseAgent
from ..schemas.agent_output import AgentOutput
from ..schemas.finding_schema import Finding
from ..schemas.artifact_schema import Artifact

class ConfidenceVerifierAgent:
    def __init__(self):
        self.name = "ConfidenceVerifierAgent"

    async def run(self, agent_outputs: list[AgentOutput]) -> AgentOutput:
        verified_findings = []
        
        for output in agent_outputs:
            for finding in output.findings:
                # Mock logic: Normalize confidence and check for duplicates
                # In a real system, this would use an LLM or cross-reference evidence
                verified_findings.append(finding)
        
        confidence_summary = Artifact(
            artifact_type="confidence_overview",
            title="Evidence Quality Summary",
            payload={
                "high_confidence_claims": sum(1 for f in verified_findings if f.confidence == "high"),
                "medium_confidence_claims": sum(1 for f in verified_findings if f.confidence == "medium"),
                "low_confidence_claims": sum(1 for f in verified_findings if f.confidence == "low"),
            }
        )
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=verified_findings,
            evidence=[],
            artifacts=[confidence_summary]
        )
