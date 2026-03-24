from pydantic import BaseModel
from typing import Optional, List


class PostCreate(BaseModel):
    title: str
    body: Optional[str] = ""
    status: Optional[str] = "open"       # open | in_progress | done | archived
    priority: Optional[str] = "medium"   # low | medium | high | urgent
    tags: Optional[List[str]] = []
    dueDate: Optional[str] = None
    assignees: Optional[List[str]] = []  # list of UIDs


class PostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    dueDate: Optional[str] = None
    assignees: Optional[List[str]] = None


class Post(BaseModel):
    id: str
    projectId: str
    title: str
    body: Optional[str] = ""
    status: str = "open"
    priority: str = "medium"
    authorId: str
    authorEmail: str
    authorName: str
    tags: Optional[List[str]] = []
    dueDate: Optional[str] = None
    assignees: Optional[List[str]] = []
    createdAt: str
    updatedAt: str
