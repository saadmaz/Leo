from typing import Dict
from backend.schemas.memory_schema import SessionMemory

class MemoryManager:
    def __init__(self):
        self._sessions: Dict[str, SessionMemory] = {}

    def get_session(self, session_id: str) -> SessionMemory:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionMemory(session_id=session_id)
        return self._sessions[session_id]

    def update_session(self, session_id: str, memory: SessionMemory):
        self._sessions[session_id] = memory
