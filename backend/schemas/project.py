from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    ownerId: str
    brandCore: Optional[dict] = None
    ingestionStatus: Optional[str] = None
    createdAt: str
    updatedAt: str
