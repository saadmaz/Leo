from pydantic import BaseModel
from typing import List, Dict, Any
from .finding_schema import Finding
from .evidence_schema import Evidence
from .artifact_schema import Artifact

from .agent_output import AgentOutput

class FinalResponse(BaseModel):
    session_id: str
    query: str
    executive_summary: str
    key_findings: List[Finding]
    facts: List[Finding]
    interpretations: List[Finding]
    recommendations: List[Finding]
    confidence_overview: Dict[str, Any]
    artifacts: List[Artifact]
    follow_up_questions: List[str]
    agent_outputs: List[AgentOutput]
    errors: List[str]
