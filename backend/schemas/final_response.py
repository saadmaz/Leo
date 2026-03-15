from pydantic import BaseModel
from typing import List, Dict, Any
from .finding_schema import Finding
from .evidence_schema import Evidence
from .artifact_schema import Artifact

class FinalResponse(BaseModel):
    executive_summary: str
    findings: List[Finding]
    facts: List[Finding]
    interpretations: List[Finding]
    evidence: List[Evidence]
    artifacts: List[Artifact]
    recommendations: List[str]
    confidence_overview: Dict[str, Any]
    follow_up_questions: List[str]
    agent_statuses: Dict[str, str]
