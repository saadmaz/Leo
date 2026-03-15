from pydantic import BaseModel
from typing import Any

class Artifact(BaseModel):
    artifact_type: str
    title: str
    payload: Any
