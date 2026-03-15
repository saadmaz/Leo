from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class QueryRequest(BaseModel):
    query: str
    company_name: Optional[str] = None
    product_name: Optional[str] = None
    session_id: str
    context: Dict[str, Any] = Field(default_factory=dict)
