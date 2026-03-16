from pydantic import BaseModel
from typing import List, Optional, Literal
from .finding_schema import Finding
from .source_schema import Source

class AgentOutput(BaseModel):
    agentId: str
    confidence: Literal["low", "medium", "high"]
    findings: List[Finding]
    sources: List[Source]
    facts: List[str]  # verifiable, has a source URL
    interpretations: List[str]  # inferred, labelled as such
    errors: Optional[List[str]] = None
