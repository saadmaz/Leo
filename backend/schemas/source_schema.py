from pydantic import BaseModel
from typing import Optional

class Source(BaseModel):
    id: str
    url: str
    title: str
    snippet: Optional[str] = None
    retrievedAt: Optional[str] = None  # ISO timestamp
    credibilityScore: Optional[float] = 0.5  # 0.0 - 1.0
