from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.schemas.query_schema import QueryRequest
from backend.schemas.final_response import FinalResponse
from backend.orchestrator.orchestrator import Orchestrator
from backend.memory.memory_manager import MemoryManager
import json
import asyncio

router = APIRouter()
orchestrator = Orchestrator()

# Use Firebase if initialized, else fallback
from backend.memory.firebase_manager import firebase_manager

@router.get("/sessions")
async def list_sessions():
    return firebase_manager.list_sessions()

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    data = firebase_manager.get_session(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")
    return data

@router.post("/query")
async def handle_query(request: QueryRequest):
    async def event_generator():
        # Queue for status updates
        queue = asyncio.Queue()

        async def status_callback(status):
            await queue.put(status)

        # Run orchestrator in a background task
        task = asyncio.create_task(orchestrator.run(request, status_callback=status_callback))

        # Stream status updates from the queue
        while not task.done():
            try:
                # Wait for status or task completion
                while not queue.empty():
                    status = await queue.get()
                    yield f"data: {json.dumps(status)}\n\n"
                await asyncio.sleep(0.1)
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break
        
        # Once done, yield the final result
        if task.done():
            try:
                final_response = await task
                
                # Save to Firebase with metadata
                from datetime import datetime
                session_data = {
                    "session_id": request.session_id,
                    "title": request.product or "New Analysis",
                    "past_queries": [request.model_dump()],
                    "last_response": final_response.model_dump(),
                    "updated_at": datetime.now().isoformat()
                }
                firebase_manager.save_session(request.session_id, session_data)

                yield f"data: {json.dumps({'status': 'final', 'data': final_response.model_dump()})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
