"""
Pillar 4 — Paid Advertising request schemas.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


AD_PLATFORMS = ["google_search", "google_display", "meta_feed", "meta_stories", "tiktok", "linkedin"]
AD_OBJECTIVES = ["awareness", "traffic", "leads", "sales", "app_installs"]


class AdBriefRequest(BaseModel):
    campaign_name: str = Field(..., min_length=1, max_length=120)
    objective: str = Field(..., description="One of: awareness, traffic, leads, sales, app_installs")
    target_audience: str = Field(..., min_length=10, max_length=500)
    platforms: List[str] = Field(..., min_length=1, max_length=6)
    daily_budget: str = Field(..., description="e.g. '$50/day' or '$1,500/month'")
    timeline: str = Field("30 days")
    product_name: str = Field(..., min_length=1, max_length=120)
    unique_selling_points: List[str] = Field(default_factory=list, max_length=5)
    landing_page_url: Optional[str] = Field(None, max_length=500)


class AdCopyRequest(BaseModel):
    platform: str = Field(..., description="One of: google_search, google_display, meta_feed, meta_stories, tiktok, linkedin")
    objective: str = Field(..., description="What the ad should drive (leads, sales, signups, etc.)")
    product_name: str = Field(..., min_length=1, max_length=120)
    product_description: str = Field(..., min_length=20, max_length=1000)
    target_audience: str = Field(..., min_length=10, max_length=500)
    tone: str = Field("professional", description="professional | casual | urgent | inspirational")
    num_variants: int = Field(3, ge=2, le=5)
    usp: List[str] = Field(default_factory=list, max_length=5)
    landing_page_url: Optional[str] = Field(None, max_length=500)


class RetargetingRequest(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=120)
    product_description: str = Field(..., min_length=20, max_length=1000)
    audience_segment: str = Field(
        ...,
        description="website_visitors | cart_abandoners | past_buyers | video_viewers | lead_nurture",
    )
    platforms: List[str] = Field(..., min_length=1, max_length=4)
    sequence_length: int = Field(5, ge=3, le=7, description="Number of touch points in the sequence")
    conversion_goal: str = Field(..., description="purchase | sign_up | demo_request | free_trial")


class ChannelMetrics(BaseModel):
    channel: str = Field(..., min_length=1)
    sessions: int = Field(0, ge=0)
    conversions: int = Field(0, ge=0)
    revenue: float = Field(0.0, ge=0)
    cost: float = Field(0.0, ge=0)


class AttributionRequest(BaseModel):
    date_range_days: int = Field(30, ge=7, le=365)
    channel_data: List[ChannelMetrics] = Field(
        default_factory=list,
        description="Manual channel metrics. Leave empty to pull from GA4 (if configured).",
    )
    conversion_goal: str = Field("purchase", description="The primary conversion event to attribute")
    currency: str = Field("USD", max_length=3)
