from pydantic import BaseModel
from typing import Literal


class Finding(BaseModel):
    statement: str
    type: Literal["fact", "interpretation", "recommendation"]
    confidence: Literal["low", "medium", "high"] = "medium"
    rationale: str = ""
