"""
Pillar 3 — SEO & Organic Search request schemas.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class KeywordResearchRequest(BaseModel):
    seed_keywords: list[str] = Field(..., min_length=1, max_length=10)
    location_code: int = Field(2840, description="DataForSEO location code (2840 = US)")
    language_code: str = Field("en")
    limit: int = Field(50, ge=5, le=200)


class SerpIntentRequest(BaseModel):
    keyword: str = Field(..., min_length=1)
    location_code: int = Field(2840)
    language_code: str = Field("en")
    depth: int = Field(10, ge=5, le=30)


class OnPageSeoRequest(BaseModel):
    url: str = Field(..., min_length=4)
    target_keyword: Optional[str] = None


class FeaturedSnippetRequest(BaseModel):
    keyword: str = Field(..., min_length=1)
    your_content: Optional[str] = None  # existing content to rewrite
    location_code: int = Field(2840)
    language_code: str = Field("en")


class ContentFreshnessRequest(BaseModel):
    url: str = Field(..., min_length=4)
    keyword: str = Field(..., min_length=1)
    location_code: int = Field(2840)
    language_code: str = Field("en")


class TechnicalSeoRequest(BaseModel):
    url: str = Field(..., min_length=4)
    enable_javascript: bool = Field(True)
