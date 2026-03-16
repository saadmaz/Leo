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
memory_manager = MemoryManager()

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
                # Save to memory
                session = memory_manager.get_session(request.session_id)
                session.past_queries.append(request)
                session.last_response = final_response
                memory_manager.update_session(request.session_id, session)

                yield f"data: {json.dumps({'status': 'final', 'data': final_response.model_dump()})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
