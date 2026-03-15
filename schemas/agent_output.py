from pydantic import BaseModel
from typing import Literal

from schemas.finding_schema import Finding
from schemas.evidence_schema import Evidence
from schemas.artifact_schema import Artifact


class AgentOutput(BaseModel):
    agent_name: str
    status: Literal["success", "error", "timeout"] = "success"
    findings: list[Finding] = []
    evidence: list[Evidence] = []
    artifacts: list[Artifact] = []
    errors: list[str] = []
