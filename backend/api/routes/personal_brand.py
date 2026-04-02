"""
Personal Branding Module routes.

Endpoints:
  POST   /projects/{id}/persona/core/init         – Create initial Personal Core
  GET    /projects/{id}/persona/core               – Get Personal Core
  PATCH  /projects/{id}/persona/core               – Update Personal Core fields
  GET    /projects/{id}/persona/interview/questions – Get all interview questions
  GET    /projects/{id}/persona/interview/next      – Get next unanswered question
  POST   /projects/{id}/persona/interview/answer    – Save a single answer
  POST   /projects/{id}/persona/interview/extract   – Synthesise answers → PersonalCore (SSE)
  GET    /projects/{id}/persona/voice               – Get voice profile
"""

import asyncio
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.api.deps import assert_editor, assert_member, get_project_or_404
from backend.middleware.auth import CurrentUser
from backend.schemas.personal_brand import (
    InterviewAnswerRequest,
    PersonalCore,
    PersonalCoreCreate,
    PersonalCoreUpdate,
)
from backend.services import firebase_service
from backend.services.personal_brand.interview_questions import (
    INTERVIEW_MODULES,
    calculate_progress,
    get_all_questions,
    get_next_unanswered,
)
from backend.services.personal_brand import extraction_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["personal-brand"])


# ---------------------------------------------------------------------------
# Guard helper — ensures project is a personal brand project
# ---------------------------------------------------------------------------

def _assert_personal(project: dict) -> None:
    if project.get("projectType") != "personal":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This project is not a Personal Brand project.",
        )


# ---------------------------------------------------------------------------
# Personal Core — init / get / update
# ---------------------------------------------------------------------------

@router.post("/{project_id}/persona/core/init", status_code=status.HTTP_201_CREATED)
async def init_personal_core(project_id: str, body: PersonalCoreCreate, user: CurrentUser):
    """
    Create the initial Personal Core for a personal brand project.
    Called immediately after project creation on the personal brand wizard.
    """
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])
    _assert_personal(project)

    existing = await asyncio.to_thread(firebase_service.get_personal_core, project_id)
    if existing:
        return existing

    core = await asyncio.to_thread(
        firebase_service.create_personal_core,
        project_id,
        body.fullName,
        body.linkedinUrl,
    )
    return core


@router.get("/{project_id}/persona/core")
async def get_personal_core(project_id: str, user: CurrentUser):
    """Return the Personal Core for a personal brand project."""
    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])
    _assert_personal(project)

    core = await asyncio.to_thread(firebase_service.get_personal_core, project_id)
    if not core:
        raise HTTPException(status_code=404, detail="Personal Core not found. Complete onboarding first.")
    return core


@router.patch("/{project_id}/persona/core")
async def update_personal_core(project_id: str, body: PersonalCoreUpdate, user: CurrentUser):
    """Update fields of the Personal Core."""
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])
    _assert_personal(project)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    updated = await asyncio.to_thread(firebase_service.update_personal_core, project_id, updates)
    return updated


# ---------------------------------------------------------------------------
# Interview — questions
# ---------------------------------------------------------------------------

@router.get("/{project_id}/persona/interview/questions")
async def get_interview_questions(project_id: str, user: CurrentUser):
    """Return all interview questions grouped by module."""
    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])
    _assert_personal(project)
    return {"modules": INTERVIEW_MODULES}


@router.get("/{project_id}/persona/interview/next")
async def get_next_question(project_id: str, user: CurrentUser):
    """
    Return the next unanswered question and current progress.
    Returns null for 'question' when the interview is complete.
    """
    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])
    _assert_personal(project)

    core = await asyncio.to_thread(firebase_service.get_personal_core, project_id)
    if not core:
        raise HTTPException(status_code=404, detail="Personal Core not found.")

    answered_keys = list(core.get("interviewAnswers", {}).keys())
    next_q = get_next_unanswered(answered_keys)
    progress = calculate_progress(answered_keys)

    return {
        "question": next_q,
        "progress": progress,
        "answeredCount": len(answered_keys),
        "totalCount": len(get_all_questions()),
        "interviewStatus": core.get("interviewStatus", "not_started"),
    }


# ---------------------------------------------------------------------------
# Interview — save answer
# ---------------------------------------------------------------------------

@router.post("/{project_id}/persona/interview/answer")
async def save_interview_answer(project_id: str, body: InterviewAnswerRequest, user: CurrentUser):
    """
    Persist a single interview answer. The client calls this after each question.
    Returns the updated next question and progress.
    """
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])
    _assert_personal(project)

    if not body.answer.strip():
        raise HTTPException(status_code=400, detail="Answer cannot be empty.")

    await asyncio.to_thread(
        firebase_service.save_interview_answer,
        project_id,
        body.questionKey,
        body.answer.strip(),
    )

    # Return the next question
    core = await asyncio.to_thread(firebase_service.get_personal_core, project_id)
    answered_keys = list(core.get("interviewAnswers", {}).keys())
    next_q = get_next_unanswered(answered_keys)
    progress = calculate_progress(answered_keys)

    return {
        "saved": True,
        "nextQuestion": next_q,
        "progress": progress,
        "answeredCount": len(answered_keys),
        "totalCount": len(get_all_questions()),
    }


# ---------------------------------------------------------------------------
# Interview — extract (SSE)
# ---------------------------------------------------------------------------

@router.post("/{project_id}/persona/interview/extract")
async def extract_personal_core(project_id: str, user: CurrentUser):
    """
    Synthesise all collected interview answers into a structured Personal Core.
    Streams progress events via SSE. Same format as the ingestion pipeline.

    The client should call this after the user has answered all questions,
    or when they want to generate from partial answers (minimum 5 answers).
    """
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])
    _assert_personal(project)

    core = await asyncio.to_thread(firebase_service.get_personal_core, project_id)
    if not core:
        raise HTTPException(status_code=404, detail="Personal Core not found.")

    answers = core.get("interviewAnswers", {})
    if len(answers) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"At least 5 answers are needed to generate your Personal Core (you have {len(answers)}).",
        )

    full_name = core.get("fullName", "")

    async def event_stream() -> AsyncIterator[str]:
        async for chunk in extraction_agent.run(project_id, full_name, answers):
            yield chunk
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Voice Profile
# ---------------------------------------------------------------------------

@router.get("/{project_id}/persona/voice")
async def get_voice_profile(project_id: str, user: CurrentUser):
    """Return the voice profile for a personal brand project."""
    project = get_project_or_404(project_id)
    assert_member(project, user["uid"])
    _assert_personal(project)

    db = firebase_service.get_db()
    doc = db.collection("personal_voice_profiles").document(project_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Voice profile not found. Complete the interview first.")
    return {"projectId": project_id, **doc.to_dict()}
