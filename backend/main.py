from fastapi import FastAPI
from .api.routes import query

app = FastAPI(title="Growth Intelligence Multi-Agent System")

# Include routes
app.include_router(query.router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "online", "system": "Multi-Agent growth intelligence"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
