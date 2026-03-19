from pydantic import BaseModel
from typing import Optional


class ChatCreate(BaseModel):
    name: Optional[str] = "New Chat"


class ChatRename(BaseModel):
    name: str


class Chat(BaseModel):
    id: str
    projectId: str
    name: str
    createdAt: str
    updatedAt: str
