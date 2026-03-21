"""
Project CRUD routes.

All project-level auth checks (existence + role) go through backend.api.deps
so the logic lives in exactly one place.
"""

from fastapi import APIRouter, status

import asyncio

from backend.api.deps import assert_admin, assert_editor, assert_member, get_project_or_404
from backend.middleware.auth import CurrentUser
from backend.schemas.project import Project, ProjectCreate, ProjectUpdate
from backend.services import billing_service, firebase_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, user: CurrentUser):
    """Create a new project. The requesting user becomes its admin."""
    # Ensure user document exists first (needed for plan lookup).
    await asyncio.to_thread(
        firebase_service.upsert_user,
        uid=user["uid"],
        email=user.get("email", ""),
        display_name=user.get("name", ""),
    )
    # Check plan limits before creating.
    await asyncio.to_thread(billing_service.assert_can_create_project, user["uid"])

    project = await asyncio.to_thread(
        firebase_service.create_project,
        owner_uid=user["uid"],
        name=body.name,
        description=body.description or "",
        website_url=body.websiteUrl,
        instagram_url=body.instagramUrl,
        facebook_url=body.facebookUrl,
        linkedin_url=body.linkedinUrl,
        tiktok_url=body.tiktokUrl,
        x_url=body.xUrl,
        youtube_url=body.youtubeUrl,
        threads_url=body.threadsUrl,
        pinterest_url=body.pinterestUrl,
        snapchat_url=body.snapchatUrl,
        content_model=body.contentModel or "claude-sonnet-4-6",
        image_model=body.imageModel or "dall-e-3",
        video_model=body.videoModel or "gemini-flash",
        prompt_model=body.promptModel or "claude-opus-4-6",
    )
    return project


@router.get("", response_model=list[Project])
async def list_projects(user: CurrentUser):
    """Return all projects the requesting user is a member of."""
    return firebase_service.list_projects(user["uid"])


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, user: CurrentUser):
    """Return a single project. Requires at least viewer membership."""
    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])
    return project


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, body: ProjectUpdate, user: CurrentUser):
    """Update name/description. Requires editor or admin role."""
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])

    updates = body.model_dump(exclude_none=True)
    if updates:
        firebase_service.update_project(project_id, updates)

    return firebase_service.get_project(project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, user: CurrentUser):
    """
    Delete a project and all its chats/messages. Requires admin role.

    Uses delete_project_deep() to cascade into subcollections so no
    orphaned chat or message documents are left in Firestore.
    """
    project = get_project_or_404(project_id)
    assert_admin(project, user["uid"])
    firebase_service.delete_project_deep(project_id)
