from fastapi import APIRouter, HTTPException
from backend.schemas.query_schema import QueryRequest
from backend.schemas.final_response import FinalResponse
from backend.orchestrator.orchestrator import Orchestrator
from backend.memory.memory_manager import MemoryManager

router = APIRouter()
orchestrator = Orchestrator()
memory_manager = MemoryManager()

@router.post("/query", response_model=FinalResponse)
async def handle_query(request: QueryRequest):
    try:
        # 1. Update memory
        session = memory_manager.get_session(request.session_id)
        session.past_queries.append(request)
        
        # 2. Run orchestrator
        response = await orchestrator.run(request)
        
        # 3. Finalize memory
        session.last_response = response
        memory_manager.update_session(request.session_id, session)
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
