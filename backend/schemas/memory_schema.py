from pydantic import BaseModel
from typing import List, Optional
from .query_schema import QueryRequest
from .final_response import FinalResponse

class SessionMemory(BaseModel):
    session_id: str
    past_queries: List[QueryRequest] = []
    last_response: Optional[FinalResponse] = None
    context: dict = {}
