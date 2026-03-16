from pydantic import BaseModel
from typing import List, Dict, Any, Literal
from backend.schemas.finding_schema import Finding
from backend.schemas.source_schema import Source
from backend.schemas.artifact_schema import Artifact
from backend.schemas.agent_output import AgentOutput

class AgentStatus(BaseModel):
    name: str
    status: Literal["success", "partial", "failed"]
    duration: int  # ms

class ConfidenceOverview(BaseModel):
    overall: Literal["high", "medium", "low"]
    byDomain: Dict[str, Literal["high", "medium", "low"]]

class FinalResponse(BaseModel):
    executiveSummary: str
    topOpportunities: List[str]
    topRisks: List[str]
    recommendedBets: List[str]
    findings: List[Finding]
    facts: List[str]
    interpretations: List[str]
    evidence: List[Source]
    artifacts: List[Artifact]
    confidenceOverview: ConfidenceOverview
    followUpQuestions: List[str]
    agentStatuses: List[AgentStatus]
    queryCostEstimate: str
