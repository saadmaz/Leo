"""
Generation routes — AI media generation beyond text.

Endpoints:
  POST /projects/{id}/generate/image  — DALL-E 3 image generation
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.api.deps import get_project_or_404, assert_member
from backend.middleware.auth import CurrentUser
from backend.services import image_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["generate"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ImageGenerateRequest(BaseModel):
    prompt: str
    style: str = "vivid"        # "vivid" | "natural"
    aspectRatio: str = "square" # "square" | "landscape" | "portrait"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/{project_id}/generate/image")
async def generate_image(
    project_id: str,
    body: ImageGenerateRequest,
    user: CurrentUser,
) -> dict:
    """
    Generate an image via DALL-E 3 and return its URL.

    The caller (typically the frontend's ImagePromptCard) is responsible for
    supplying a fully-formed prompt. Brand context should already be baked in
    by Claude when it produced the image_prompt artifact.

    Returns:
        { "url": "https://..." }  — URL valid for ~1 hour from OpenAI.
    """
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])

    try:
        url = await image_service.generate_image(
            prompt=body.prompt,
            style=body.style,
            aspect_ratio=body.aspectRatio,
        )
    except RuntimeError as exc:
        # OPENAI_API_KEY missing
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"url": url}
