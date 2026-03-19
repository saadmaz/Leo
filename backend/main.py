import logging
import os
import sys

# Ensure the repo root is on the path so `backend.xxx` imports resolve.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.services import firebase_service
from backend.api.routes import projects, chats, stream

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="LEO — Brand Marketing Co-pilot",
    description="API for LEO: brand ingestion, chat, campaign generation.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

origins = [settings.FRONTEND_URL]
if settings.ENVIRONMENT == "development":
    origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    firebase_service.initialize()
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY is not set — chat will not work.")
    else:
        logger.info("Anthropic API key loaded.")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(projects.router)
app.include_router(chats.router)
app.include_router(stream.router)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
def root():
    return {"status": "online", "service": "LEO API", "version": "0.1.0"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.get("/debug/config", tags=["health"])
def debug_config():
    """Shows which API keys are loaded (values never exposed)."""
    def is_set(val):
        return "SET" if val else "MISSING"

    return {
        "ANTHROPIC_API_KEY": is_set(settings.ANTHROPIC_API_KEY),
        "FIREBASE_PROJECT_ID": is_set(settings.FIREBASE_PROJECT_ID),
        "FIRECRAWL_API_KEY": is_set(settings.FIRECRAWL_API_KEY),
        "APIFY_API_KEY": is_set(settings.APIFY_API_KEY),
        "YOUTUBE_API_KEY": is_set(settings.YOUTUBE_API_KEY),
        "RESEND_API_KEY": is_set(settings.RESEND_API_KEY),
        "STRIPE_SECRET_KEY": is_set(settings.STRIPE_SECRET_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
