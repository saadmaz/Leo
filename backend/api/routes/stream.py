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
    """
    Persist a user message then stream the assistant's response as SSE.

    Auth checks:
      - Project must exist.
      - Requesting user must be a project member (any role).
      - Chat must exist within the project.

    Side effects:
      - Saves the user message to Firestore before streaming begins.
      - Auto-renames the chat using the first 40 chars of the first message.
      - Saves the assembled assistant response after the stream completes.
    """
    # --- Auth & existence checks ---
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    if user["uid"] not in project.get("members", {}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    chat = firebase_service.get_chat(project_id, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    # --- Persist user message before streaming ---
    # Persisting first ensures the message is saved even if the stream fails.
    firebase_service.save_message(project_id, chat_id, "user", body.content)

    # --- Auto-name chat on first message ---
    # "New Chat" is the default name; replace it once the user sends something.
    if chat.get("name") == "New Chat":
        short_name = body.content[:40].strip()
        if short_name:
            firebase_service.rename_chat(project_id, chat_id, short_name)

    # --- Load message history for LLM context ---
    # We exclude the message we just saved because stream_chat() appends it
    # as the final "user" turn. Using MESSAGES_LOAD_LIMIT here is fine —
    # stream_chat() further trims to LLM_CONTEXT_MESSAGES.
    from backend.config import settings
    all_messages = firebase_service.list_messages(project_id, chat_id, limit=settings.MESSAGES_LOAD_LIMIT)
    # Exclude the last entry (the user message we just saved above).
    history = all_messages[:-1]

    async def event_stream():
        """
        Async generator that:
        1. Forwards SSE delta chunks from llm_service to the HTTP response.
        2. Collects delta text in memory to reconstruct the full response.
        3. Persists the assembled assistant message after the stream ends.
        """
        assembled_parts: list[str] = []

        try:
            async for chunk in llm_service.stream_chat(
                project_name=project.get("name", ""),
                brand_core=project.get("brandCore"),
                history=history,
                user_message=body.content,
            ):
                yield chunk

                # --- Reconstruct full response from delta chunks ---
                # Parse each SSE line to extract delta text. This is more
                # robust than the previous approach of joining raw chunk strings
                # because it handles multi-part deltas and ignores non-delta
                # events (errors, [DONE]).
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
                    pass  # Ignore malformed chunks — they will be logged by llm_service

        except Exception as exc:
            logger.exception("Streaming error in send_message: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
            return

        # --- Persist assistant response ---
        full_response = "".join(assembled_parts)
        if full_response:
            firebase_service.save_message(project_id, chat_id, "assistant", full_response)
        else:
            logger.warning(
                "Stream completed for chat %s but no assistant content was collected.", chat_id
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Prevent proxy/CDN buffering — required for SSE to work correctly.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
