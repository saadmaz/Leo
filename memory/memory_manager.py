from datetime import datetime, timezone


class MemoryManager:
    """
    Lightweight in-memory session store for follow-up context.
    Stores past queries and last synthesis per session.
    """

    def __init__(self) -> None:
        self._store: dict[str, dict] = {}

    def store(self, session_id: str, query: str, summary: str) -> None:
        if session_id not in self._store:
            self._store[session_id] = {"queries": [], "last_summary": ""}

        self._store[session_id]["queries"].append({
            "query": query,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        self._store[session_id]["last_summary"] = summary

    def get_context(self, session_id: str) -> dict | None:
        return self._store.get(session_id)

    def get_history(self, session_id: str) -> list[dict]:
        ctx = self._store.get(session_id)
        if ctx:
            return ctx["queries"]
        return []

    def clear(self, session_id: str) -> None:
        self._store.pop(session_id, None)
