from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput
from schemas.query_schema import QueryRequest


class ConfidenceAgent(BaseAgent):
    """
    Inspects findings from other agents and normalizes confidence labels.

    Scoring logic (hackathon-grade):
        1 evidence item  → low
        2 evidence items → medium
        3+ evidence items → high
    Also boosts if evidence comes from diverse source types.
    """

    name = "ConfidenceAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        # Not used via the normal run() path; see score_outputs() instead.
        return AgentOutput(agent_name=self.name, status="success")

    def score_outputs(self, outputs: list[AgentOutput]) -> dict:
        """Score each agent's output and return a confidence overview."""
        overview: dict[str, dict] = {}

        for output in outputs:
            if output.status != "success":
                overview[output.agent_name] = {"confidence": "n/a", "reason": "agent failed"}
                continue

            evidence_count = len(output.evidence)
            source_types = set(e.source_type for e in output.evidence)
            diversity = len(source_types)

            # Base score from evidence count
            if evidence_count >= 3:
                level = "high"
            elif evidence_count == 2:
                level = "medium"
            else:
                level = "low"

            # Diversity bonus: bump up one level if sources are diverse
            if diversity >= 3 and level == "medium":
                level = "high"
            elif diversity >= 2 and level == "low":
                level = "medium"

            # Also normalize per-finding confidence based on agent-level score
            for finding in output.findings:
                if level == "low" and finding.confidence == "high":
                    finding.confidence = "medium"

            overview[output.agent_name] = {
                "confidence": level,
                "evidence_count": evidence_count,
                "source_diversity": diversity,
            }

        return overview
