from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class Evidence(BaseModel):
    id: str
    source_type: str
    url: Optional[str] = None
    title: str
    snippet: str
    collected_at: datetime
    entity: str
    tags: List[str]
