import logging
import os
import sys
from contextlib import asynccontextmanager

# Ensure the repo root is on the path so `backend.xxx` imports resolve
# regardless of the working directory from which the server is launched.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.services import firebase_service
from backend.api.routes import projects, chats, stream, ingestion, brand_core, billing, assets, campaigns, generate, members
from backend.middleware.request_id import RequestIdFilter, RequestIdMiddleware

# ---------------------------------------------------------------------------
# Logging — include request ID in every log line.
# Format: "2024-01-01 12:00:00 [req_id=abc123] INFO backend.foo — message"
# Outside a request context, req_id shows as '-'.
# ---------------------------------------------------------------------------
_log_handler = logging.StreamHandler()
_log_handler.setFormatter(logging.Formatter(
    fmt="%(asctime)s [req_id=%(request_id)s] %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))
# Filter must be on the handler (not the logger) so it runs for records
# propagated up from uvicorn's child loggers too.
_log_handler.addFilter(RequestIdFilter())

logging.basicConfig(handlers=[_log_handler], level=settings.LOG_LEVEL, force=True)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — runs once on startup and once on shutdown.
# Replaces the deprecated @app.on_event("startup") pattern.
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    try:
        firebase_service.initialize()
    except Exception as exc:
        # Log but don't crash — the /health endpoint must stay reachable
        # even if Firebase credentials are missing or misconfigured.
        logger.error("Firebase initialisation failed: %s", exc, exc_info=True)

    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY is not set — chat and ingestion will not work.")
    else:
        logger.info("Anthropic API key loaded (model: %s).", settings.LLM_CHAT_MODEL)

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY is not set — image generation will return 503.")
    else:
        logger.info("OpenAI API key loaded — image generation enabled.")

    yield  # server is running

    # --- Shutdown (add cleanup here if needed, e.g. close DB pools) ---
    logger.info("LEO API shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="LEO — Brand Marketing Co-pilot",
    description="API for LEO: brand ingestion, conversational chat, and campaign generation.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

# Allow the configured frontend origin plus localhost variants in development.
# In production, FRONTEND_URL should be the exact deployed origin.
_origins = [settings.FRONTEND_URL]
if settings.ENVIRONMENT == "development":
    _origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stamp every request with a unique ID for log correlation.
# Must be added AFTER CORSMiddleware so it runs on the inner request.
app.add_middleware(RequestIdMiddleware)

# ---------------------------------------------------------------------------
# Routes — each router is scoped to its own prefix/tag set
# ---------------------------------------------------------------------------

app.include_router(projects.router)
app.include_router(chats.router)
app.include_router(stream.router)
app.include_router(ingestion.router)
app.include_router(brand_core.router)
app.include_router(billing.router)
app.include_router(assets.router)
app.include_router(campaigns.router)
app.include_router(generate.router)
app.include_router(members.router)

# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
def root():
    """Liveness probe — returns service identity."""
    return {"status": "online", "service": "LEO API", "version": "0.1.0"}


@app.get("/health", tags=["health"])
def health():
    """Simple liveness check used by load balancers and uptime monitors."""
    return {"status": "ok"}


@app.get("/debug/config", tags=["health"])
def debug_config():
    """Shows which API keys are present (dev only). Values are NEVER exposed."""
    if settings.ENVIRONMENT == "production":
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(status_code=404, detail="Not found")

    def _status(val: str | None) -> str:
        return "SET" if val else "MISSING"

    return {
        "ANTHROPIC_API_KEY": _status(settings.ANTHROPIC_API_KEY),
        "OPENAI_API_KEY": _status(settings.OPENAI_API_KEY),
        "FIREBASE_PROJECT_ID": _status(settings.FIREBASE_PROJECT_ID),
        "FIRECRAWL_API_KEY": _status(settings.FIRECRAWL_API_KEY),
        "APIFY_API_KEY": _status(settings.APIFY_API_KEY),
        "YOUTUBE_API_KEY": _status(settings.YOUTUBE_API_KEY),
        "RESEND_API_KEY": _status(settings.RESEND_API_KEY),
        "STRIPE_SECRET_KEY": _status(settings.STRIPE_SECRET_KEY),
        "LLM_CHAT_MODEL": settings.LLM_CHAT_MODEL,
        "LLM_EXTRACTION_MODEL": settings.LLM_EXTRACTION_MODEL,
        "ENVIRONMENT": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
