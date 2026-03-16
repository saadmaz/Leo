from pydantic import BaseModel
from typing import List, Literal

class Finding(BaseModel):
    claim: str
    confidence: Literal["low", "medium", "high"]
    sourceIds: List[str]
    isFactual: bool
