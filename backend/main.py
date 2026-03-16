import os
import sys

# Add project root to sys.path to support 'backend.xxx' imports
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(root_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import query

app = FastAPI(title="Growth Intelligence Multi-Agent System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon/development. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes - Removed /api prefix to match frontend's fetch("/query")
app.include_router(query.router)

@app.get("/")
def read_root():
    return {"status": "online", "system": "Multi-Agent growth intelligence"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/debug/config")
async def debug_config():
    from backend.config import settings
    return {
        "ANTHROPIC_API_KEY": "SET" if settings.ANTHROPIC_API_KEY and "your_" not in settings.ANTHROPIC_API_KEY else "MISSING",
        "SERPAPI_API_KEY": "SET" if settings.SERPAPI_API_KEY and "your_" not in settings.SERPAPI_API_KEY else "MISSING",
        "OPENAI_API_KEY": "SET" if settings.OPENAI_API_KEY and "your_" not in settings.OPENAI_API_KEY else "MISSING",
        "CRUNCHBASE_API_KEY": "SET" if settings.CRUNCHBASE_API_KEY and "your_" not in settings.CRUNCHBASE_API_KEY else "MISSING",
        "ADZUNA_APP_ID": "SET" if settings.ADZUNA_APP_ID and "your_" not in settings.ADZUNA_APP_ID else "MISSING",
        "NEWSAPI_KEY": "SET" if settings.NEWSAPI_KEY and "your_" not in settings.NEWSAPI_KEY else "MISSING",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
