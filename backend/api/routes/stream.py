"""
Chat streaming route — POST a user message and receive an SSE stream of
Claude's response deltas.

SSE event format (each line):
    data: {"type": "delta", "content": "..."}
    data: {"type": "error", "error": "..."}
    data: [DONE]

The assistant's full response is reconstructed server-side from the delta
stream and persisted to Firestore once the stream completes.
"""

import json
import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.api.deps import get_project_as_member
from backend.middleware.auth import CurrentUser
from backend.schemas.message import MessageCreate
from backend.services import billing_service, firebase_service, llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/chats/{chat_id}", tags=["stream"])


@router.post("/messages")
async def send_message(
    project_id: str,
    chat_id: str,
    body: MessageCreate,
    user: CurrentUser,
):
    """
    Persist a user message then stream the assistant's response as SSE.

    Auth: any project member may send messages.

    Side effects:
      - Saves the user message to Firestore before streaming begins.
      - Auto-renames the chat using the first 40 chars of the first message.
      - Saves the assembled assistant response after the stream completes.
    """
    # Verify project membership (raises 404/403 via deps).
    project = get_project_as_member(project_id, user["uid"])

    # Check message quota before doing anything else.
    import asyncio
    await asyncio.to_thread(billing_service.assert_can_send_message, user["uid"])

    chat = firebase_service.get_chat(project_id, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    # Persist user message before streaming so it's saved even if stream fails.
    firebase_service.save_message(project_id, chat_id, "user", body.content)

    # Auto-name the chat on the first real message.
    if chat.get("name") == "New Chat":
        short_name = body.content[:40].strip()
        if short_name:
            firebase_service.rename_chat(project_id, chat_id, short_name)

    # Load message history. stream_chat() trims further to LLM_CONTEXT_MESSAGES.
    from backend.config import settings
    all_messages = firebase_service.list_messages(
        project_id, chat_id, limit=settings.MESSAGES_LOAD_LIMIT
    )
    # Exclude the last entry (the user message we just saved) since
    # stream_chat() appends it separately as the final user turn.
    history = all_messages[:-1]

    async def event_stream():
        assembled_parts: list[str] = []

        # Convert Pydantic ImageAttachment objects to plain dicts for llm_service.
        images = (
            [{"base64": img.base64, "mediaType": img.mediaType} for img in body.images]
            if body.images
            else None
        )

        try:
            async for chunk in llm_service.stream_chat(
                project_name=project.get("name", ""),
                brand_core=project.get("brandCore"),
                history=history,
                user_message=body.content,
                channel=body.channel,
                images=images,
            ):
                yield chunk

                # Accumulate delta text to reconstruct the full response.
                if not chunk.startswith("data: "):
                    continue
                raw = chunk[6:].strip()
                if raw == "[DONE]":
                    continue
                try:
                    payload = json.loads(raw)
                    if payload.get("type") == "delta" and "content" in payload:
                        assembled_parts.append(payload["content"])
                except json.JSONDecodeError:
                    pass

        except Exception as exc:
            logger.exception("Streaming error in send_message: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
            return

        # Persist the complete assistant response and count the message.
        full_response = "".join(assembled_parts)
        if full_response:
            firebase_service.save_message(project_id, chat_id, "assistant", full_response)
            billing_service.increment_message_count(user["uid"])
        else:
            logger.warning(
                "Stream completed for chat %s but no assistant content was collected.", chat_id
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
