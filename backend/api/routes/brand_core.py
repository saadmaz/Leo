"""
Brand Core CRUD routes.

GET  /projects/{id}/brand-core          → return full brand core
PATCH /projects/{id}/brand-core         → partial update (any top-level field)
PATCH /projects/{id}/brand-core/{field} → update a single section (tone/visual/etc.)
DELETE /projects/{id}/brand-core        → clear brand core
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.middleware.auth import CurrentUser
from backend.services import firebase_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["brand-core"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BrandCoreUpdate(BaseModel):
    """
    Partial update — accepts any subset of brand core fields.
    Using dict so we don't tightly couple the route to the schema.
    """
    tone: Optional[dict] = None
    visual: Optional[dict] = None
    themes: Optional[list[str]] = None
    tagline: Optional[str] = None
    messaging: Optional[dict] = None
    audience: Optional[dict] = None
    competitors: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/{project_id}/brand-core")
async def get_brand_core(
    project_id: str,
    user: dict = Depends(CurrentUser),
) -> dict:
    project = _require_member(project_id, user["uid"])
    return {"brandCore": project.get("brandCore"), "ingestionStatus": project.get("ingestionStatus")}


@router.patch("/{project_id}/brand-core")
async def update_brand_core(
    project_id: str,
    body: BrandCoreUpdate,
    user: dict = Depends(CurrentUser),
) -> dict:
    """Merge provided fields into the existing Brand Core."""
    project = _require_editor(project_id, user["uid"])

    existing: dict = project.get("brandCore") or {}
    updates = body.model_dump(exclude_none=True)

    # Deep merge — only replace sections that were provided
    merged = {**existing, **updates}

    firebase_service.update_project(project_id, {"brandCore": merged})
    return {"brandCore": merged}


@router.patch("/{project_id}/brand-core/{field}")
async def update_brand_core_field(
    project_id: str,
    field: str,
    body: dict,
    user: dict = Depends(CurrentUser),
) -> dict:
    """Update a single named section of the Brand Core (e.g. 'tone', 'visual')."""
    allowed = {"tone", "visual", "themes", "tagline", "messaging", "audience", "competitors"}
    if field not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown Brand Core field: {field}")

    project = _require_editor(project_id, user["uid"])
    existing: dict = project.get("brandCore") or {}
    merged = {**existing, field: body.get("value", body)}

    firebase_service.update_project(project_id, {"brandCore": merged})
    return {"brandCore": merged}


@router.delete("/{project_id}/brand-core")
async def clear_brand_core(
    project_id: str,
    user: dict = Depends(CurrentUser),
) -> dict:
    """Clear the Brand Core (e.g. to re-ingest from scratch)."""
    _require_editor(project_id, user["uid"])
    firebase_service.update_project(project_id, {"brandCore": None, "ingestionStatus": None})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_member(project_id: str, uid: str) -> dict:
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if uid not in project.get("members", {}):
        raise HTTPException(status_code=403, detail="Not a project member")
    return project


def _require_editor(project_id: str, uid: str) -> dict:
    project = _require_member(project_id, uid)
    role = project.get("members", {}).get(uid)
    if role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor or Admin role required")
    return project
