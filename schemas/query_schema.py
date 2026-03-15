from pydantic import BaseModel, Field
from typing import Optional
import uuid


class QueryRequest(BaseModel):
    query: str
    company_name: str = ""
    product_name: str = ""
    context: Optional[str] = None
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class OrchestratorResponse(BaseModel):
    session_id: str
    query: str
    executive_summary: str = ""
    key_findings: list[dict] = []
    facts: list[dict] = []
    interpretations: list[dict] = []
    recommendations: list[dict] = []
    confidence_overview: dict = {}
    artifacts: list[dict] = []
    follow_up_questions: list[str] = []
    agent_outputs: list[dict] = []
    errors: list[str] = []
