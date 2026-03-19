import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.middleware.auth import CurrentUser
from backend.schemas.message import MessageCreate
from backend.services import firebase_service, llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/chats/{chat_id}", tags=["stream"])


@router.post("/messages")
async def send_message(
    project_id: str,
    chat_id: str,
    body: MessageCreate,
    user: CurrentUser,
):
    # --- Auth & existence checks ---
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    if user["uid"] not in project.get("members", {}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    chat = firebase_service.get_chat(project_id, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    # --- Persist user message ---
    firebase_service.save_message(project_id, chat_id, "user", body.content)

    # --- Auto-name chat on first message ---
    if chat.get("name") == "New Chat":
        short_name = body.content[:40].strip()
        if short_name:
            firebase_service.rename_chat(project_id, chat_id, short_name)

    # --- Load message history for context ---
    history = firebase_service.list_messages(project_id, chat_id, limit=20)

    async def event_stream():
        collected: list[str] = []
        try:
            async for chunk in llm_service.stream_chat(
                project_name=project.get("name", ""),
                brand_core=project.get("brandCore"),
                history=history[:-1],  # exclude the message we just saved (already appended in stream_chat)
                user_message=body.content,
            ):
                collected.append(chunk)
                yield chunk

        except Exception as exc:
            logger.exception("Streaming error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
            return

        # --- Persist assistant response ---
        full_response = "".join(
            json.loads(c[6:])["content"]
            for c in collected
            if c.startswith("data: ") and c.strip() != "data: [DONE]"
            and "content" in json.loads(c[6:])
        )
        if full_response:
            firebase_service.save_message(project_id, chat_id, "assistant", full_response)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
