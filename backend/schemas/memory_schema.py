from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from backend.schemas.query_schema import QueryRequest
from backend.schemas.final_response import FinalResponse

class SessionMemory(BaseModel):
    session_id: str
    title: str = "New Analysis"
    past_queries: List[QueryRequest] = []
    last_response: Optional[FinalResponse] = None
    context: Dict[str, Any] = {}
    updated_at: Optional[str] = None
