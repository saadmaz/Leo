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
from backend.schemas.pillar1 import (
    ICPGenerateRequest,
    GTMGenerateRequest,
    OKRGenerateRequest,
    BudgetModelRequest,
    PersonaGenerateRequest,
    MarketSizingRequest,
    PositioningStartRequest,
    PositioningMessageRequest,
    CompMapGenerateRequest,
    LaunchPlanRequest,
    RiskScanRequest,
)
from backend.schemas.pillar2 import (
    HeadlineGenerateRequest,
    VisualBriefRequest,
    VideoScriptRequest,
    PodcastNotesRequest,
    QualityScoreRequest,
    TranslateRequest,
    CaseStudyRequest,
    ContentGapRequest,
)
from backend.services import firebase_service, strategy_service, credits_service
from backend.services.pillar1 import (
    icp_service,
    gtm_service,
    okr_service,
    budget_service,
    persona_service,
    market_sizing_service,
    positioning_service,
    comp_positioning_service,
    launch_service,
    risk_service,
)
from backend.services.pillar2 import (
    headline_service,
    visual_brief_service,
    video_script_service,
    podcast_service,
    quality_service,
    translate_service,
    case_study_service,
    content_gap_service,
)

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


# ===========================================================================
# Pillar 1 — Strategy & Planning features
# ===========================================================================

# ---------------------------------------------------------------------------
# ICP Builder
# ---------------------------------------------------------------------------

@router.post("/pillar1/icp/generate")
async def generate_icp(project_id: str, body: ICPGenerateRequest, user: CurrentUser):
    """Generate Ideal Customer Profile segments. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_icp")

    async def event_stream():
        try:
            gen = await icp_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("ICP generation error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/icp/list")
async def list_icps(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "icp")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# GTM Strategy
# ---------------------------------------------------------------------------

@router.post("/pillar1/gtm/generate")
async def generate_gtm(project_id: str, body: GTMGenerateRequest, user: CurrentUser):
    """Generate GTM strategy. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_gtm")

    async def event_stream():
        try:
            gen = await gtm_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("GTM generation error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/gtm/list")
async def list_gtms(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "gtm")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Quarterly OKR Drafting
# ---------------------------------------------------------------------------

@router.post("/pillar1/okr/generate")
async def generate_okr(project_id: str, body: OKRGenerateRequest, user: CurrentUser):
    """Generate quarterly OKRs (fast, non-streaming)."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_okr")
    doc = await okr_service.generate(project, body, project_id, user["uid"])
    return doc


@router.get("/pillar1/okr/list")
async def list_okrs(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "okr")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Budget Modelling
# ---------------------------------------------------------------------------

@router.post("/pillar1/budget/model")
async def model_budget(project_id: str, body: BudgetModelRequest, user: CurrentUser):
    """Generate budget model. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_budget")

    async def event_stream():
        try:
            gen = await budget_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Budget model error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/budget/list")
async def list_budgets(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "budget")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Persona Generation
# ---------------------------------------------------------------------------

@router.post("/pillar1/personas/generate")
async def generate_personas(project_id: str, body: PersonaGenerateRequest, user: CurrentUser):
    """Generate buyer personas. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_persona")

    async def event_stream():
        try:
            gen = await persona_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Persona generation error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/personas/list")
async def list_personas(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "persona")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Market Sizing
# ---------------------------------------------------------------------------

@router.post("/pillar1/market-size/analyze")
async def analyze_market_size(project_id: str, body: MarketSizingRequest, user: CurrentUser):
    """Generate TAM/SAM/SOM analysis. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_market_sizing")

    async def event_stream():
        try:
            gen = await market_sizing_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Market sizing error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/market-size/list")
async def list_market_sizes(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "market_sizing")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Positioning Workshop
# ---------------------------------------------------------------------------

@router.post("/pillar1/positioning/start")
async def start_positioning(project_id: str, body: PositioningStartRequest, user: CurrentUser):
    """Start a new Positioning Workshop session. Returns doc_id."""
    get_project_as_member(project_id, user["uid"])
    doc = await asyncio.to_thread(
        positioning_service.start_session, project_id, user["uid"], body
    )
    return {"doc_id": doc["id"], "stage": 0, "stage_label": "Who are you for?"}


@router.post("/pillar1/positioning/{doc_id}/message")
async def positioning_message(
    project_id: str,
    doc_id: str,
    body: PositioningMessageRequest,
    user: CurrentUser,
):
    """Send a message in the Positioning Workshop. Streams SSE events. 5 credits/message."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_positioning_msg")

    async def event_stream():
        try:
            gen = await positioning_service.send_message(project, doc_id, body, project_id)
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Positioning workshop error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/positioning/{doc_id}")
async def get_positioning_session(project_id: str, doc_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    doc = await asyncio.to_thread(firebase_service.get_pillar1_doc, project_id, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    messages = await asyncio.to_thread(firebase_service.list_pillar1_messages, project_id, doc_id)
    return {"doc": doc, "messages": messages}


# ---------------------------------------------------------------------------
# Competitive Positioning Map
# ---------------------------------------------------------------------------

@router.post("/pillar1/comp-map/generate")
async def generate_comp_map(project_id: str, body: CompMapGenerateRequest, user: CurrentUser):
    """Generate competitive positioning map. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_comp_map")

    async def event_stream():
        try:
            gen = await comp_positioning_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Comp map generation error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/comp-map/list")
async def list_comp_maps(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "comp_map")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Launch Planning
# ---------------------------------------------------------------------------

@router.post("/pillar1/launch/plan")
async def plan_launch(project_id: str, body: LaunchPlanRequest, user: CurrentUser):
    """Generate launch plan. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_launch")

    async def event_stream():
        try:
            gen = await launch_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Launch plan error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/launch/list")
async def list_launches(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "launch")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Risk Flagging
# ---------------------------------------------------------------------------

@router.post("/pillar1/risk/scan")
async def scan_risks(project_id: str, body: RiskScanRequest, user: CurrentUser):
    """Run risk scan. Streams SSE events."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar1_risk_scan")

    async def event_stream():
        try:
            gen = await risk_service.generate(project, body, project_id, user["uid"])
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Risk scan error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/pillar1/risk/alerts")
async def list_risk_alerts(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "risk_flag")
    return {"docs": docs}


@router.post("/pillar1/risk/alerts/{doc_id}/dismiss/{risk_id}")
async def dismiss_risk_alert(project_id: str, doc_id: str, risk_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(firebase_service.dismiss_risk_alert, project_id, doc_id, risk_id)
    return {"status": "dismissed"}


# ===========================================================================
# Pillar 2 — Content Creation & Management
# ===========================================================================

def _p2_stream(service_fn, project, body, project_id, uid):
    """Helper: wrap a pillar2 service generator in a StreamingResponse."""
    async def event_stream():
        try:
            gen = await service_fn(project, body, project_id, uid)
            async for chunk in gen:
                yield chunk
        except Exception as exc:
            logger.exception("Pillar 2 stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------------------
# Headline A/B Variants
# ---------------------------------------------------------------------------

@router.post("/pillar2/headline/generate")
async def generate_headlines(project_id: str, body: HeadlineGenerateRequest, user: CurrentUser):
    """Generate headline A/B variants. Streams SSE events. 5 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_headline")
    return _p2_stream(headline_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/headline/list")
async def list_headlines(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "headline")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Visual Brief Generation
# ---------------------------------------------------------------------------

@router.post("/pillar2/visual-brief/generate")
async def generate_visual_brief(project_id: str, body: VisualBriefRequest, user: CurrentUser):
    """Generate a visual creative brief. Streams SSE events. 5 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_visual_brief")
    return _p2_stream(visual_brief_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/visual-brief/list")
async def list_visual_briefs(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "visual_brief")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Video Script Writing
# ---------------------------------------------------------------------------

@router.post("/pillar2/video-script/generate")
async def generate_video_script(project_id: str, body: VideoScriptRequest, user: CurrentUser):
    """Generate a full video script. Streams SSE events. 15 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_video_script")
    return _p2_stream(video_script_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/video-script/list")
async def list_video_scripts(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "video_script")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Podcast Show Notes
# ---------------------------------------------------------------------------

@router.post("/pillar2/podcast/process")
async def process_podcast(project_id: str, body: PodcastNotesRequest, user: CurrentUser):
    """Transcribe and generate podcast show notes. Streams SSE events. 20 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_podcast")
    return _p2_stream(podcast_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/podcast/list")
async def list_podcasts(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "podcast")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Content Quality Scoring
# ---------------------------------------------------------------------------

@router.post("/pillar2/quality/score")
async def score_content_quality(project_id: str, body: QualityScoreRequest, user: CurrentUser):
    """Score content quality across 6 dimensions. Streams SSE events. 10 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_quality")
    return _p2_stream(quality_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/quality/list")
async def list_quality_scores(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "quality_score")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Multilingual Adaptation
# ---------------------------------------------------------------------------

@router.post("/pillar2/translate/adapt")
async def adapt_translation(project_id: str, body: TranslateRequest, user: CurrentUser):
    """Translate and adapt content via DeepL + Claude. Streams SSE events. 15 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_translate")
    return _p2_stream(translate_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/translate/list")
async def list_translations(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "translation")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Case Study Production
# ---------------------------------------------------------------------------

@router.post("/pillar2/case-study/generate")
async def generate_case_study(project_id: str, body: CaseStudyRequest, user: CurrentUser):
    """Generate a publication-ready case study. Streams SSE events. 15 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_case_study")
    return _p2_stream(case_study_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/case-study/list")
async def list_case_studies(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "case_study")
    return {"docs": docs}


# ---------------------------------------------------------------------------
# Content Gap Analysis
# ---------------------------------------------------------------------------

@router.post("/pillar2/content-gap/analyze")
async def analyze_content_gap(project_id: str, body: ContentGapRequest, user: CurrentUser):
    """Analyse content gaps via DataForSEO + Claude. Streams SSE events. 40 credits."""
    project = get_project_as_member(project_id, user["uid"])
    await asyncio.to_thread(credits_service.check_and_deduct, user["uid"], "pillar2_content_gap")
    return _p2_stream(content_gap_service.generate, project, body, project_id, user["uid"])


@router.get("/pillar2/content-gap/list")
async def list_content_gaps(project_id: str, user: CurrentUser):
    get_project_as_member(project_id, user["uid"])
    docs = await asyncio.to_thread(firebase_service.list_pillar1_docs, project_id, "content_gap")
    return {"docs": docs}
