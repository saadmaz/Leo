"""
Pillar 6 — Social Media request schemas (gap features only).

Already-built features that are NOT here:
  - Multi-Platform Scheduling   → personal_brand/ayrshare_service.py
  - Social Listening            → intelligence_service.py
  - Trend Detection             → intelligence_service.py
  - Hashtag Strategy            → intelligence_service.py
  - Social Ad Creative          → Carousel Studio
  - Platform Analytics          → personal_brand/analytics_service.py
  - Influencer Discovery        → intelligence_service.discover_influencers() (v1 only)
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Community Management
# ---------------------------------------------------------------------------

class ManualComment(BaseModel):
    """A comment pasted manually (fallback when Ayrshare pull is unavailable)."""
    comment_id: str = Field(default="", description="External ID or leave blank")
    author: str = Field(default="", description="Username / display name of commenter")
    platform: str = Field(..., description="instagram | twitter | facebook | linkedin | tiktok | threads")
    text: str = Field(..., min_length=1, max_length=2000)
    sentiment_hint: Optional[str] = Field(None, description="Optional: positive | neutral | negative | question")


class CommunityManagementRequest(BaseModel):
    reply_tone: str = Field(
        "warm, helpful, and on-brand",
        description="Tone for drafted replies (e.g. 'professional', 'playful', 'empathetic')",
    )
    # Ayrshare pull (optional — requires AYRSHARE_API_KEY + project profile)
    ayrshare_post_ids: Optional[List[str]] = Field(
        None,
        description="Ayrshare post IDs to pull live comments from via the API",
        max_length=10,
    )
    # Manual comment input (fallback or supplement)
    manual_comments: Optional[List[ManualComment]] = Field(
        None,
        description="Paste comments directly if not using Ayrshare pull",
        max_length=50,
    )
    brand_guidelines: Optional[str] = Field(
        None,
        max_length=500,
        description="Any brand-specific reply rules (e.g. 'never offer discounts in comments', 'always sign off with 👋')",
    )


# ---------------------------------------------------------------------------
# Social Proof Harvesting
# ---------------------------------------------------------------------------

class SocialProofRequest(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=120)
    keywords: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Search terms — product name, brand handles, slogans, campaign tags",
    )
    platforms: List[str] = Field(
        default_factory=lambda: ["twitter", "instagram", "linkedin"],
        description="Platforms to search (used for Tavily/Exa web search framing)",
    )
    # User can also paste raw mentions/comments directly
    raw_mentions: Optional[List[str]] = Field(
        None,
        max_length=100,
        description="Paste raw mention/comment text if you have it already",
    )
    harvest_goal: str = Field(
        "testimonials",
        description="testimonials | ugc | sentiment | case_study_leads",
    )


# ---------------------------------------------------------------------------
# Employee Advocacy
# ---------------------------------------------------------------------------

class EmployeeAdvocacyRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=5,
        max_length=300,
        description="What this batch of posts is about (e.g. 'our new AI reporting feature launch')",
    )
    key_messages: List[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="Brand talking points to weave in (e.g. 'saves 5 hrs/week', 'no code required')",
    )
    employee_persona: str = Field(
        ...,
        min_length=5,
        max_length=200,
        description="Describe the employee writing these posts (e.g. 'Senior Account Executive, 5 years in B2B SaaS, informal and curious')",
    )
    platforms: List[str] = Field(
        default_factory=lambda: ["linkedin", "twitter"],
        description="Target platforms for the posts",
    )
    num_posts: int = Field(5, ge=1, le=15, description="Posts to generate per platform")
    tone: str = Field(
        "authentic and personal",
        description="Writing tone (e.g. 'enthusiastic', 'thought-leader', 'storytelling')",
    )
    avoid_phrases: Optional[List[str]] = Field(
        None,
        max_length=10,
        description="Corporate phrases to avoid (e.g. 'synergy', 'best-in-class')",
    )
    push_to_ayrshare: bool = Field(
        False,
        description="Draft-push the first post per platform to Ayrshare for review",
    )
    ayrshare_profile_key: Optional[str] = Field(
        None,
        description="Ayrshare profile key of the employee's personal profile (if push_to_ayrshare=True)",
    )
