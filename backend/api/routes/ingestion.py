"""
Brand ingestion route — streams real-time progress over SSE while the
pipeline scrapes and analyses brand content.

Flow:
  1. Client POSTs { websiteUrl?, instagramHandle? } to /projects/{id}/ingest
  2. Server validates input and checks editor-level project access.
  3. Response is a streaming SSE connection that emits step/progress/done/error events.
  4. On receiving a 'done' event the client updates its local brand core state.

SSE event shapes (JSON inside `data: ...` lines):
  { "type": "step",     "label": "...", "status": "running|done|error|skipped", "detail": "..." }
  { "type": "progress", "pct": 0-100 }
  { "type": "done",     "brandCore": { ... } }
  { "type": "error",    "message": "..." }
"""

import json
import logging
from typing import AsyncIterator, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from backend.middleware.auth import CurrentUser
from backend.services import firebase_service
from backend.services.ingestion import pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["ingestion"])


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    """
    At least one of websiteUrl or instagramHandle must be provided.
    Validation is enforced in the route handler rather than here so we can
    return a meaningful HTTP 422 with a clear message.
    """
    websiteUrl: Optional[str] = None
    instagramHandle: Optional[str] = None

    @field_validator("websiteUrl")
    @classmethod
    def normalise_url(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace; add https:// if the user omits the scheme."""
        if v is None:
            return v
        v = v.strip()
        if v and not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v or None

    @field_validator("instagramHandle")
    @classmethod
    def normalise_handle(cls, v: Optional[str]) -> Optional[str]:
        """Strip leading @, whitespace, and trailing slashes."""
        if v is None:
            return v
        return v.strip().lstrip("@").rstrip("/") or None


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    """Format a dict as a single SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/{project_id}/ingest")
async def ingest_brand(
    project_id: str,
    body: IngestRequest,
    user: CurrentUser,  # Uses the CurrentUser type alias (already has Depends baked in)
) -> StreamingResponse:
    """
    Start brand ingestion for a project. Returns an SSE stream.

    Requires editor or admin role. The SSE stream ends with either a
    'done' event (success) or an 'error' event (failure), followed by
    the sentinel line `data: [DONE]`.
    """
    # Validate that at least one source was provided.
    if not body.websiteUrl and not body.instagramHandle:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: websiteUrl or instagramHandle.",
        )

    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    role = project.get("members", {}).get(user["uid"])
    if role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor or Admin role required.")

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in pipeline.run(
                project_id=project_id,
                website_url=body.websiteUrl,
                instagram_handle=body.instagramHandle,
            ):
                yield _sse(event)
        except Exception as exc:
            logger.exception("Ingestion stream error for project %s: %s", project_id, exc)
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            # Always send the SSE sentinel so the client knows the stream ended.
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
