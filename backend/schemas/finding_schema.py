from pydantic import BaseModel
from typing import List, Literal

class Finding(BaseModel):
    id: str
    statement: str
    type: Literal["fact", "interpretation", "signal"]
    confidence: Literal["low", "medium", "high"]
    rationale: str
    domain: str
    evidence_ids: List[str]
