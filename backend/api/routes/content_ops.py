"""
Content Operations routes — Phase 2.

Endpoints:
  POST /projects/{id}/content-library                 — Save item to library
  GET  /projects/{id}/content-library                 — List library items (with filters)
  PATCH /projects/{id}/content-library/{item_id}      — Update status / content
  DELETE /projects/{id}/content-library/{item_id}     — Delete item

  POST /projects/{id}/content/bulk-generate           — Bulk generate (SSE)
  POST /projects/{id}/content/recycle                 — Recycle content variants
  POST /projects/{id}/content/transform               — Transform to all platforms

  POST /projects/{id}/calendar/generate               — AI calendar generation
  GET  /projects/{id}/calendar                        — List calendar entries
  POST /projects/{id}/calendar/entries                — Add entry manually
  PATCH /projects/{id}/calendar/entries/{entry_id}    — Update entry
  DELETE /projects/{id}/calendar/entries/{entry_id}   — Delete entry
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import get_project_as_member, get_project_as_editor
from backend.middleware.auth import CurrentUser
from backend.services import firebase_service, content_ops_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}", tags=["content-ops"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ContentLibraryItemCreate(BaseModel):
    platform: str = Field(..., max_length=64)
    type: str = Field(..., max_length=64)       # caption | ad_copy | video_script | email | image_prompt
    content: str = Field(..., max_length=10000)
    hashtags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)  # headline, hook, cta, scenes, subject, etc.
    status: str = Field(default="draft")          # draft | approved | scheduled | posted
    tags: list[str] = Field(default_factory=list)


class ContentLibraryItemUpdate(BaseModel):
    content: Optional[str] = Field(None, max_length=10000)
    status: Optional[str] = None
    tags: Optional[list[str]] = None
    hashtags: Optional[list[str]] = None
    scheduledAt: Optional[str] = None


class BulkGenerateRequest(BaseModel):
    platforms: list[str] = Field(..., min_length=1, max_length=6)
    count_per_platform: int = Field(default=5, ge=1, le=10)
    themes: list[str] = Field(default_factory=list, max_length=10)
    period: str = Field(default="this month", max_length=100)
    goal: str = Field(default="grow brand awareness", max_length=300)


class RecycleRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)
    platform: str = Field(..., max_length=64)
    count: int = Field(default=3, ge=1, le=5)


class TransformRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=5000)
    target_platforms: list[str] = Field(..., min_length=1, max_length=6)


class CalendarGenerateRequest(BaseModel):
    platforms: list[str] = Field(..., min_length=1, max_length=6)
    period: str = Field(default="next 4 weeks", max_length=100)
    goals: str = Field(default="grow brand awareness and engagement", max_length=500)
    posts_per_week: int = Field(default=3, ge=1, le=14)


class CalendarEntryCreate(BaseModel):
    date: str = Field(..., max_length=10)         # YYYY-MM-DD
    platform: str = Field(..., max_length=64)
    content: str = Field(..., max_length=5000)
    time: Optional[str] = Field(None, max_length=5)   # HH:MM
    hashtags: list[str] = Field(default_factory=list)
    type: str = Field(default="post", max_length=64)
    content_format: str = Field(default="post", max_length=64)
    status: str = Field(default="planned")
    content_library_item_id: Optional[str] = None


class CalendarEntryUpdate(BaseModel):
    content: Optional[str] = Field(None, max_length=5000)
    date: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    hashtags: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Content Library
# ---------------------------------------------------------------------------

@router.post("/content-library")
async def save_to_library(
    project_id: str,
    body: ContentLibraryItemCreate,
    user: CurrentUser,
):
    """Save a content item to the project's library."""
    get_project_as_member(project_id, user["uid"])
    item = await asyncio.to_thread(
        firebase_service.save_content_library_item,
        project_id,
        body.model_dump(),
    )
    return item


@router.get("/content-library")
async def list_library(
    project_id: str,
    user: CurrentUser,
    platform: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
):
    """List content library items with optional filters."""
    get_project_as_member(project_id, user["uid"])
    items = await asyncio.to_thread(
        firebase_service.list_content_library_items,
        project_id, platform, status, type, limit,
    )
    return {"items": items}


@router.patch("/content-library/{item_id}")
async def update_library_item(
    project_id: str,
    item_id: str,
    body: ContentLibraryItemUpdate,
    user: CurrentUser,
):
    """Update a content library item (status, content, tags, schedule)."""
    get_project_as_member(project_id, user["uid"])
    item = await asyncio.to_thread(
        firebase_service.update_content_library_item,
        project_id, item_id, body.model_dump(exclude_none=True),
    )
    return item


@router.delete("/content-library/{item_id}", status_code=204)
async def delete_library_item(
    project_id: str,
    item_id: str,
    user: CurrentUser,
):
    """Delete a content library item."""
    get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(firebase_service.delete_content_library_item, project_id, item_id)


# ---------------------------------------------------------------------------
# Bulk Content Generation (SSE)
# ---------------------------------------------------------------------------

@router.post("/content/bulk-generate")
async def bulk_generate(
    project_id: str,
    body: BulkGenerateRequest,
    user: CurrentUser,
):
    """
    Generate multiple pieces of content across platforms.
    Streams each generated item as an SSE event.
    Automatically saves approved items to the content library.
    """
    project = get_project_as_editor(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    async def event_stream():
        async for chunk in content_ops_service.stream_bulk_generate(
            project_name=project.get("name", ""),
            brand_core=brand_core,
            platforms=body.platforms,
            count_per_platform=body.count_per_platform,
            themes=body.themes,
            period=body.period,
            goal=body.goal,
        ):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Content Recycler
# ---------------------------------------------------------------------------

@router.post("/content/recycle")
async def recycle_content(
    project_id: str,
    body: RecycleRequest,
    user: CurrentUser,
):
    """Generate fresh variants of existing content."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    try:
        result = await content_ops_service.recycle_content(
            body.content, body.platform, brand_core, body.count
        )
        return result
    except Exception as exc:
        logger.error("Content recycle failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Platform Format Transformer
# ---------------------------------------------------------------------------

@router.post("/content/transform")
async def transform_content(
    project_id: str,
    body: TransformRequest,
    user: CurrentUser,
):
    """Transform one piece of content into platform-native versions for all target platforms."""
    project = get_project_as_member(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    try:
        result = await content_ops_service.transform_to_all_platforms(
            body.content, body.target_platforms, brand_core
        )
        return result
    except Exception as exc:
        logger.error("Content transform failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

@router.post("/calendar/generate")
async def generate_calendar(
    project_id: str,
    body: CalendarGenerateRequest,
    user: CurrentUser,
):
    """AI-generate a full content calendar and save entries to Firestore."""
    project = get_project_as_editor(project_id, user["uid"])
    brand_core = project.get("brandCore") or {}

    try:
        result = await content_ops_service.generate_calendar(
            project_name=project.get("name", ""),
            brand_core=brand_core,
            platforms=body.platforms,
            period=body.period,
            goals=body.goals,
            posts_per_week=body.posts_per_week,
        )

        # Persist all generated entries to Firestore
        entries = result.get("entries", [])
        saved = []
        for entry in entries:
            saved_entry = await asyncio.to_thread(
                firebase_service.save_calendar_entry, project_id, entry
            )
            saved.append(saved_entry)

        return {"entries": saved, "count": len(saved)}

    except Exception as exc:
        logger.error("Calendar generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/calendar")
async def get_calendar(
    project_id: str,
    user: CurrentUser,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    """Return calendar entries for the project, optionally filtered by date range."""
    get_project_as_member(project_id, user["uid"])
    entries = await asyncio.to_thread(
        firebase_service.list_calendar_entries, project_id, from_date, to_date
    )
    return {"entries": entries}


@router.post("/calendar/entries")
async def create_calendar_entry(
    project_id: str,
    body: CalendarEntryCreate,
    user: CurrentUser,
):
    """Manually add an entry to the calendar."""
    get_project_as_editor(project_id, user["uid"])
    entry = await asyncio.to_thread(
        firebase_service.save_calendar_entry, project_id, body.model_dump(exclude_none=True)
    )
    return entry


@router.patch("/calendar/entries/{entry_id}")
async def update_calendar_entry(
    project_id: str,
    entry_id: str,
    body: CalendarEntryUpdate,
    user: CurrentUser,
):
    """Update a calendar entry."""
    get_project_as_editor(project_id, user["uid"])
    entry = await asyncio.to_thread(
        firebase_service.update_calendar_entry,
        project_id, entry_id, body.model_dump(exclude_none=True),
    )
    return entry


@router.delete("/calendar/entries/{entry_id}", status_code=204)
async def delete_calendar_entry(
    project_id: str,
    entry_id: str,
    user: CurrentUser,
):
    """Delete a calendar entry."""
    get_project_as_editor(project_id, user["uid"])
    await asyncio.to_thread(firebase_service.delete_calendar_entry, project_id, entry_id)
