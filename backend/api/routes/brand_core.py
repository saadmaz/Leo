"""
Brand Core CRUD routes.

Endpoints:
  GET    /projects/{id}/brand-core           → return current brand core + ingestion status
  PATCH  /projects/{id}/brand-core           → deep-merge provided fields into existing core
  PATCH  /projects/{id}/brand-core/{field}   → update a single named section
  DELETE /projects/{id}/brand-core           → wipe brand core and ingestion status

Auth: all mutating operations require editor or admin role.
"""

import logging
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Body, HTTPException
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
    Partial update payload. Any combination of top-level brand core sections
    may be provided; omitted fields are left unchanged (deep merge).
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
    user: CurrentUser,
) -> dict:
    """Return the project's current Brand Core and ingestion status."""
    project = _require_member(project_id, user["uid"])
    return {
        "brandCore": project.get("brandCore"),
        "ingestionStatus": project.get("ingestionStatus"),
    }


@router.patch("/{project_id}/brand-core")
async def update_brand_core(
    project_id: str,
    body: BrandCoreUpdate,
    user: CurrentUser,
) -> dict:
    """
    Merge the provided fields into the existing Brand Core.
    Only sections explicitly included in the request body are updated;
    other sections are left untouched (shallow merge at the top level).
    """
    project = _require_editor(project_id, user["uid"])

    existing: dict = project.get("brandCore") or {}
    updates = body.model_dump(exclude_none=True)

    # Shallow merge: replace top-level sections that were provided.
    # For deep merges within a section (e.g. updating only tone.style),
    # use the per-field PATCH endpoint below.
    merged = {**existing, **updates}

    firebase_service.update_project(project_id, {"brandCore": merged})
    return {"brandCore": merged}


# Allowed Brand Core section names. Validated before writing to prevent
# arbitrary keys being injected into the Firestore document.
_ALLOWED_FIELDS = frozenset({"tone", "visual", "themes", "tagline", "messaging", "audience", "competitors"})


@router.patch("/{project_id}/brand-core/{field}")
async def update_brand_core_field(
    project_id: str,
    field: str,
    # Body() tells FastAPI to read this parameter from the JSON request body
    # rather than treating it as a query/path param. Without Body(), FastAPI
    # won't know how to deserialise a raw dict from the request.
    body: Annotated[Any, Body()],
    user: CurrentUser,
) -> dict:
    """
    Update a single named section of the Brand Core (e.g. 'tone', 'visual').

    The request body should be the new value for that section. For example,
    to update tone: PATCH /brand-core/tone with body {"style": "playful", ...}
    """
    if field not in _ALLOWED_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown Brand Core field: {field!r}. Allowed: {sorted(_ALLOWED_FIELDS)}",
        )

    project = _require_editor(project_id, user["uid"])
    existing: dict = project.get("brandCore") or {}

    # If the caller wraps the value in {"value": ...}, unwrap it.
    # Otherwise treat the entire body as the new field value.
    value = body.get("value", body) if isinstance(body, dict) else body
    merged = {**existing, field: value}

    firebase_service.update_project(project_id, {"brandCore": merged})
    return {"brandCore": merged}


@router.delete("/{project_id}/brand-core")
async def clear_brand_core(
    project_id: str,
    user: CurrentUser,
) -> dict:
    """
    Wipe the Brand Core and reset ingestion status to None.
    Useful when re-ingesting from scratch or resetting a project.
    """
    _require_editor(project_id, user["uid"])
    firebase_service.update_project(project_id, {"brandCore": None, "ingestionStatus": None})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Shared auth helpers
# ---------------------------------------------------------------------------

def _require_member(project_id: str, uid: str) -> dict:
    """
    Fetch the project and assert the user is a member (any role).
    Raises 404 if the project does not exist, 403 if not a member.
    """
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    if uid not in project.get("members", {}):
        raise HTTPException(status_code=403, detail="Not a project member.")
    return project


def _require_editor(project_id: str, uid: str) -> dict:
    """
    Fetch the project and assert the user has editor or admin role.
    Raises 404/403 as appropriate.
    """
    project = _require_member(project_id, uid)
    role = project.get("members", {}).get(uid)
    if role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor or Admin role required.")
    return project
