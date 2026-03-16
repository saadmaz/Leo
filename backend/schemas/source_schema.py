from pydantic import BaseModel
from typing import Optional

class Source(BaseModel):
    id: str
    url: str
    title: str
    retrievedAt: str  # ISO timestamp
    credibilityScore: float  # 0.0 - 1.0
