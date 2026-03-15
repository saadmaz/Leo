from pydantic import BaseModel
from typing import List, Optional
from .finding_schema import Finding
from .evidence_schema import Evidence
from .artifact_schema import Artifact

class AgentOutput(BaseModel):
    agent_name: str
    status: str  # "success" | "partial" | "failed"
    findings: List[Finding]
    evidence: List[Evidence]
    artifacts: List[Artifact]
    errors: Optional[List[str]] = None
