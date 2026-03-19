from pydantic import BaseModel
from typing import Literal


class MessageCreate(BaseModel):
    content: str


class Message(BaseModel):
    id: str
    chatId: str
    projectId: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: str
