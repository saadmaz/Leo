from pydantic import BaseModel
from typing import List, Literal, Optional


class ImageAttachment(BaseModel):
    """A base64-encoded image sent alongside a user message."""
    base64: str       # raw base64 (no data-URL prefix)
    mediaType: str    # image/jpeg | image/png | image/gif | image/webp


class MessageCreate(BaseModel):
    content: str
    # Optional channel key (e.g. "instagram", "linkedin") used to inject
    # platform-specific constraints into the system prompt.
    channel: Optional[str] = None
    # Optional images attached by the user (vision).
    images: Optional[List[ImageAttachment]] = None


class Message(BaseModel):
    id: str
    chatId: str
    projectId: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: str
