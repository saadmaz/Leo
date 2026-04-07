"""
Pydantic request/response schemas for Pillar 2 — Content Creation & Management.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Headline A/B Variants
# ---------------------------------------------------------------------------

class HeadlineGenerateRequest(BaseModel):
    topic: str = Field(..., description="The topic, content piece title, or article summary")
    platform: str = Field(default="General", description="LinkedIn, Twitter/X, Email, YouTube, etc.")
    count: int = Field(default=5, ge=3, le=10)
    tone: Optional[str] = None


# ---------------------------------------------------------------------------
# Visual Brief Generation
# ---------------------------------------------------------------------------

class VisualBriefRequest(BaseModel):
    content_type: str = Field(..., description="social_post | blog_cover | ad | email_banner | thumbnail")
    description: str = Field(..., description="What this visual should communicate")
    platform: Optional[str] = None
    dimensions: Optional[str] = None   # e.g. "1080x1080", "1200x628"
    brand_tone: Optional[str] = None


# ---------------------------------------------------------------------------
# Video Script Writing
# ---------------------------------------------------------------------------

class VideoScriptRequest(BaseModel):
    topic: str
    duration_minutes: int = Field(default=3, ge=1, le=30)
    platform: str = Field(default="YouTube", description="YouTube | TikTok | LinkedIn | Instagram Reels")
    tone: Optional[str] = None
    include_broll: bool = True
    cta: Optional[str] = None


# ---------------------------------------------------------------------------
# Podcast Show Notes
# ---------------------------------------------------------------------------

class PodcastNotesRequest(BaseModel):
    audio_url: Optional[str] = Field(default=None, description="Public URL to audio file (mp3/mp4/wav/m4a)")
    transcript: Optional[str] = Field(default=None, description="Pre-existing transcript text")
    episode_title: Optional[str] = None
    speaker_names: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Content Quality Scoring
# ---------------------------------------------------------------------------

class QualityScoreRequest(BaseModel):
    content: str = Field(..., description="The full text content to score")
    platform: str = Field(default="General", description="LinkedIn | Twitter/X | Blog | Email | Instagram")
    content_type: str = Field(default="post", description="post | article | email | caption | ad_copy")


# ---------------------------------------------------------------------------
# Multilingual Adaptation
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    content: str = Field(..., description="Source content to translate and adapt")
    source_lang: str = Field(default="EN", description="ISO 639-1 source language code")
    target_langs: list[str] = Field(..., min_length=1, description="e.g. ['ES', 'FR', 'DE', 'AR']")
    preserve_tone: bool = True


# ---------------------------------------------------------------------------
# Case Study Production
# ---------------------------------------------------------------------------

class CaseStudyRequest(BaseModel):
    client_name: str
    industry: str
    challenge: str = Field(..., description="The problem or challenge the client faced")
    solution: str = Field(..., description="How your product/service solved it")
    results: str = Field(..., description="Measurable outcomes, e.g. '40% revenue increase in 3 months'")
    testimonial: Optional[str] = None


# ---------------------------------------------------------------------------
# Content Gap Analysis
# ---------------------------------------------------------------------------

class ContentGapRequest(BaseModel):
    domain: str = Field(..., description="Your website domain, e.g. leoagent.online")
    competitor_domains: list[str] = Field(default_factory=list, description="Competitor domains to compare against")
    location_code: int = Field(default=2840, description="DataForSEO location code (2840=US)")
    language_code: str = Field(default="en")
    limit: int = Field(default=20, ge=5, le=50)
