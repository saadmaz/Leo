from pydantic import BaseModel
from typing import Optional

class QueryRequest(BaseModel):
    product: str
    domain: str
    question: str
    session_id: str
