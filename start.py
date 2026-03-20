"""
Entrypoint for Railway/production deployments.
Reads PORT from the environment so Railway's health check probes the right port.
"""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        timeout_keep_alive=65,
    )
