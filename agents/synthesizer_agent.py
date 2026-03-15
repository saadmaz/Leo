from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput
from schemas.query_schema import QueryRequest


class SynthesizerAgent(BaseAgent):
    """
    Combines outputs from all specialist agents into a unified response.
    Produces: executive_summary, key_findings, facts, interpretations,
    recommendations, confidence_overview, artifacts, follow_up_questions.
    """

    name = "SynthesizerAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        # Not used via normal run(); see synthesize() instead.
        return AgentOutput(agent_name=self.name, status="success")

    def synthesize(
        self,
        query: QueryRequest,
        outputs: list[AgentOutput],
        confidence_overview: dict,
    ) -> dict:
        facts: list[dict] = []
        interpretations: list[dict] = []
        recommendations: list[dict] = []
        all_findings: list[dict] = []
        all_artifacts: list[dict] = []

        for output in outputs:
            if output.status != "success":
                continue
            for f in output.findings:
                entry = {
                    "agent": output.agent_name,
                    "statement": f.statement,
                    "confidence": f.confidence,
                    "rationale": f.rationale,
                }
                all_findings.append(entry)
                if f.type == "fact":
                    facts.append(entry)
                elif f.type == "interpretation":
                    interpretations.append(entry)
                elif f.type == "recommendation":
                    recommendations.append(entry)

            for a in output.artifacts:
                all_artifacts.append(
                    {"agent": output.agent_name, "artifact_type": a.artifact_type, "payload": a.payload}
                )

        # Build executive summary from top high-confidence findings
        high_conf = [f for f in all_findings if f["confidence"] == "high"]
        summary_points = high_conf[:3] if high_conf else all_findings[:3]
        executive_summary = "Key insights: " + " | ".join(
            f["statement"] for f in summary_points
        )

        # Generate follow-up questions based on gaps
        follow_ups = self._generate_follow_ups(query, outputs, confidence_overview)

        return {
            "executive_summary": executive_summary,
            "key_findings": all_findings,
            "facts": facts,
            "interpretations": interpretations,
            "recommendations": recommendations,
            "confidence_overview": confidence_overview,
            "artifacts": all_artifacts,
            "follow_up_questions": follow_ups,
        }

    def _generate_follow_ups(
        self,
        query: QueryRequest,
        outputs: list[AgentOutput],
        confidence_overview: dict,
    ) -> list[str]:
        questions: list[str] = []

        # Suggest deeper dives for low-confidence areas
        for agent_name, info in confidence_overview.items():
            if isinstance(info, dict) and info.get("confidence") == "low":
                questions.append(f"Can you provide more data on {agent_name.replace('Agent', '')} analysis?")

        # Generic follow-ups
        company = query.company_name or "this company"
        questions.extend([
            f"What is {company}'s ideal customer profile?",
            f"How does {company}'s retention compare to competitors?",
            "What are the biggest risks to current market positioning?",
        ])

        return questions[:5]
