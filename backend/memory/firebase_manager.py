from typing import Optional, Dict, Any, List
from backend.schemas.memory_schema import SessionMemory
from backend.schemas.final_response import FinalResponse
import json

class FirebaseManager:
    def __init__(self):
        self.db = None
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return
        
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            
            # Try to initialize with default credentials (e.g. from environment)
            # or look for serviceAccountKey.json
            cred_path = "serviceAccountKey.json"
            import os
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                # Fallback to default credentials if possible
                firebase_admin.initialize_app()
            
            self.db = firestore.client()
            self._initialized = True
            print("Firebase initialized successfully.")
        except Exception as e:
            print(f"Firebase initialization failed: {e}. Falling back to in-memory.")

    def save_session(self, session_id: str, memory_data: Dict[str, Any]):
        if not self._initialized or not self.db:
            return
        try:
            self.db.collection("sessions").document(session_id).set(memory_data)
        except Exception as e:
            print(f"Error saving to Firebase: {e}")

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not self._initialized or not self.db:
            return None
        try:
            doc = self.db.collection("sessions").document(session_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Error loading from Firebase: {e}")
        return None

    def list_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """List recent sessions for the history sidebar."""
        if not self._initialized or not self.db:
            return []
        try:
            # We assume 'updated_at' or similar exists, or just get snapshots
            docs = self.db.collection("sessions").limit(limit).stream()
            sessions = []
            for doc in docs:
                data = doc.to_dict()
                sessions.append({
                    "id": doc.id,
                    "title": data.get("title", "New Analysis"),
                    "updated_at": data.get("updated_at")
                })
            return sessions
        except Exception as e:
            print(f"Error listing sessions: {e}")
            return []

firebase_manager = FirebaseManager()
