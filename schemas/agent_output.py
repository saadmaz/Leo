from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime, timezone

from schemas.finding_schema import Finding


class Evidence(BaseModel):
    source_type: str = ""
    url: str = ""
    title: str = ""
    snippet: str = ""
    collected_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class Artifact(BaseModel):
    artifact_type: str = ""
    payload: dict = {}


class AgentOutput(BaseModel):
    agent_name: str
    status: Literal["success", "error", "timeout"] = "success"
    findings: list[Finding] = []
    evidence: list[Evidence] = []
    artifacts: list[Artifact] = []
    errors: list[str] = []
