from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import query

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
