"""
Funnel Strategy Engine — API routes.

POST /projects/{project_id}/strategy/start
    Detect intent, create session, return first question.

POST /projects/{project_id}/strategy/{session_id}/answer
    Store an intake answer, return next question or signal done.

POST /projects/{project_id}/strategy/{session_id}/research  (SSE)
    Run live research (Trends + Apify + Firecrawl), stream progress.

POST /projects/{project_id}/strategy/{session_id}/generate  (SSE)
    Build prompt from research + Brand Core, stream Claude strategy.

GET  /projects/{project_id}/strategy/list
    Return all saved strategies for a project.

POST /projects/{project_id}/strategy/{strategy_id}/refine   (SSE)
    Follow-up conversation on an existing strategy.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.api.deps import get_project_as_member
from backend.middleware.auth import CurrentUser
from backend.schemas.strategy import (
    StrategyAnswerRequest,
    StrategyRefineRequest,
    StrategyStartRequest,
)
from backend.services import firebase_service, strategy_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects/{project_id}/strategy", tags=["strategy"])


# ---------------------------------------------------------------------------
# Start a strategy session
# ---------------------------------------------------------------------------

@router.post("/start")
async def start_strategy(
    project_id: str,
    body: StrategyStartRequest,
    user: CurrentUser,
):
    """
    Creates a new strategy session and returns the first intake question.
    Also validates that strategy intent was actually present.
    """
    project = get_project_as_member(project_id, user["uid"])

    # Create the session in Firestore (status: intake, no funnel type yet)
    session = firebase_service.create_strategy_session(project_id, {
        "user_goal": body.user_goal,
        "funnel_type": None,
        "funnel_framework": None,
        "intake_answers": {},
        "status": "intake",
        "owner_uid": user["uid"],
    })

    # The very first "question" is the funnel selector — the frontend renders
    # this as a special widget, but we include a text fallback too.
    return {
        "session_id": session["id"],
        "status": "intake",
        "next_question": {
            "index": -1,            # -1 = funnel selector (special)
            "text": "Which funnel are you working on?",
            "type": "funnel_selector",
        },
        "message": "Let's build your strategy. First, which part of the funnel do you want to focus on?",
    }


# ---------------------------------------------------------------------------
# Submit an answer
# ---------------------------------------------------------------------------

@router.post("/{session_id}/answer")
async def answer_question(
    project_id: str,
    session_id: str,
    body: StrategyAnswerRequest,
    user: CurrentUser,
):
    """
    Stores one intake answer and returns the next question.
    When question_index == -1 the answer is the funnel type selection.
    When all questions are answered returns status='research_ready'.
    """
    project = get_project_as_member(project_id, user["uid"])
    session = firebase_service.get_strategy_session(project_id, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    intake: dict = session.get("intake_answers") or {}

    if body.question_index == -1:
        # Funnel type selection
        funnel_type = body.funnel_type or body.answer.lower()
        if funnel_type not in strategy_service.FUNNEL_TYPES:
            funnel_type = "full"
        firebase_service.update_strategy_session(project_id, session_id, {
            "funnel_type": funnel_type,
            "intake_answers": intake,
        })
        session["funnel_type"] = funnel_type
        answer_count = 0
    else:
        # Regular intake question — store with key q{index}
        key = f"q{body.question_index}"
        intake[key] = body.answer
        firebase_service.update_strategy_session(project_id, session_id, {
            "intake_answers": intake,
        })
        session["intake_answers"] = intake
        answer_count = len([v for v in intake.values() if v])

    next_q = strategy_service.get_question_for_session(session, answer_count)

    if next_q is None:
        # All questions answered
        firebase_service.update_strategy_session(project_id, session_id, {"status": "researching"})
        return {
            "session_id": session_id,
            "status": "research_ready",
            "next_question": None,
            "message": (
                "Got it. Give me a moment — I'm going to research your industry, "
                "check what's trending, and look at what's working for similar brands."
            ),
        }

    return {
        "session_id": session_id,
        "status": "intake",
        "next_question": next_q,
        "question_number": answer_count + 1,
        "total_questions": len(
            strategy_service.FUNNEL_TYPES.get(
                session.get("funnel_type", "full"), {}
            ).get("questions", [])
        ),
    }


# ---------------------------------------------------------------------------
# Research (SSE)
# ---------------------------------------------------------------------------

@router.post("/{session_id}/research")
async def run_research(
    project_id: str,
    session_id: str,
    user: CurrentUser,
):
    """
    Triggers live research (Google Trends + Apify + Firecrawl).
    Streams SSE progress events then emits research_complete.
    """
    project = get_project_as_member(project_id, user["uid"])
    session = firebase_service.get_strategy_session(project_id, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    async def event_stream():
        try:
            async for chunk in strategy_service.run_research(session, project, project_id):
                yield chunk
        except Exception as exc:
            logger.exception("Research stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Generate strategy (SSE)
# ---------------------------------------------------------------------------

@router.post("/{session_id}/generate")
async def generate_strategy(
    project_id: str,
    session_id: str,
    user: CurrentUser,
):
    """
    Generates the full strategy document from research cache + Brand Core.
    Streams Claude token deltas then emits strategy_saved with the ID.
    """
    project = get_project_as_member(project_id, user["uid"])
    session = firebase_service.get_strategy_session(project_id, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    async def event_stream():
        try:
            async for chunk in strategy_service.generate_strategy(session, project, project_id):
                yield chunk
        except Exception as exc:
            logger.exception("Generation stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# List saved strategies
# ---------------------------------------------------------------------------

@router.get("/list")
async def list_strategies(
    project_id: str,
    user: CurrentUser,
):
    """Return all saved strategies for a project, newest first."""
    get_project_as_member(project_id, user["uid"])
    strategies = firebase_service.list_marketing_strategies(project_id)
    return {"strategies": strategies}


# ---------------------------------------------------------------------------
# Refine / follow-up (SSE)
# ---------------------------------------------------------------------------

@router.post("/{strategy_id}/refine")
async def refine_strategy(
    project_id: str,
    strategy_id: str,
    body: StrategyRefineRequest,
    user: CurrentUser,
):
    """
    Stream a follow-up response to an existing strategy.
    The full strategy markdown is included as context for Claude.
    """
    get_project_as_member(project_id, user["uid"])
    strategy = firebase_service.get_marketing_strategy(project_id, strategy_id)
    if not strategy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found.")

    async def event_stream():
        try:
            async for chunk in strategy_service.refine_strategy(strategy, body.follow_up_message):
                yield chunk
        except Exception as exc:
            logger.exception("Refinement stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
