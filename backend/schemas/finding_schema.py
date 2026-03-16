from pydantic import BaseModel
from typing import List, Literal, Optional

class Finding(BaseModel):
    id: str
    claim: str
    confidence: Literal["low", "medium", "high"]
    sourceIds: List[str]
    isFactual: bool
    rationale: Optional[str] = None
    domain: Optional[str] = None
