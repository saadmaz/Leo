"""
Ingestion route — POST to start brand ingestion, GET to stream progress via SSE.

Flow:
  1. Client POSTs { websiteUrl?, instagramHandle? } to /projects/{id}/ingest
  2. Server streams SSE events (step updates, progress pct, final brandCore)
  3. On 'done' event client updates its local project state
"""

import json
import logging
from typing import Optional, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.middleware.auth import CurrentUser
from backend.services import firebase_service
from backend.services.ingestion import pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["ingestion"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    websiteUrl: Optional[str] = None
    instagramHandle: Optional[str] = None


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/{project_id}/ingest")
async def ingest_brand(
    project_id: str,
    body: IngestRequest,
    user: dict = Depends(CurrentUser),
) -> StreamingResponse:
    """
    Start brand ingestion. Returns a streaming SSE response with real-time
    step progress. The final event has type='done' and contains the brandCore.
    """
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    uid = user["uid"]
    role = project.get("members", {}).get(uid)
    if role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor or Admin role required")

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in pipeline.run(
                project_id=project_id,
                website_url=body.websiteUrl or None,
                instagram_handle=body.instagramHandle or None,
            ):
                yield _sse(event)
        except Exception as exc:
            logger.exception("Ingestion stream error: %s", exc)
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
