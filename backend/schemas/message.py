from pydantic import BaseModel
from typing import Literal, Optional


class MessageCreate(BaseModel):
    content: str
    # Optional channel key (e.g. "instagram", "linkedin") used to inject
    # platform-specific constraints into the system prompt.
    channel: Optional[str] = None


class Message(BaseModel):
    id: str
    chatId: str
    projectId: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: str
