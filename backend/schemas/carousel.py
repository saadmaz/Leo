"""
Pydantic schemas for the Carousel Studio feature.
"""

from __future__ import annotations
from typing import Optional, Any, Union
from pydantic import BaseModel


class ScrapeBrandRequest(BaseModel):
    project_id: str
    website_url: str
    instagram_url: Optional[str] = None


class CreateSessionRequest(BaseModel):
    project_id: str


class IntakeAnswerRequest(BaseModel):
    session_id: str
    question: Union[int, str]   # 0=init, 1–5 normal, "3b"=custom slide count
    answer: str


class GenerateCarouselRequest(BaseModel):
    session_id: str


class EditSlideRequest(BaseModel):
    carousel_id: str
    slide_index: int
    instruction: str


class ExportCarouselRequest(BaseModel):
    carousel_id: str
    format: str = "portrait"   # portrait | square | landscape | stories
