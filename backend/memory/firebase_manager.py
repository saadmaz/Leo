import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional, Dict, Any
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
            # Try to initialize with default credentials (e.g. from environment)
            # or look for serviceAccountKey.json
            cred_path = "serviceAccountKey.json"
            if hasattr(credentials, 'Certificate') and (cred_path := "serviceAccountKey.json") and (cred_path):
                # We check for the file in the current directory
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
        if not self._initialized:
            return
        try:
            self.db.collection("sessions").document(session_id).set(memory_data)
        except Exception as e:
            print(f"Error saving to Firebase: {e}")

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not self._initialized:
            return None
        try:
            doc = self.db.collection("sessions").document(session_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Error loading from Firebase: {e}")
        return None

firebase_manager = FirebaseManager()
