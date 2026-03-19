import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import firebase_admin
from firebase_admin import auth, credentials, firestore

logger = logging.getLogger(__name__)

_db: Any = None


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def initialize() -> None:
    global _db
    if firebase_admin._apps:
        _db = firestore.client()
        return

    from backend.config import settings

    cred: Optional[credentials.Base] = None

    # Option 1: service account JSON file on disk
    sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        logger.info("Firebase: loaded service account from %s", sa_path)

    # Option 2: inline env vars
    elif settings.FIREBASE_PRIVATE_KEY and settings.FIREBASE_CLIENT_EMAIL:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": settings.FIREBASE_PROJECT_ID,
            "private_key": settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
            "client_email": settings.FIREBASE_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        logger.info("Firebase: loaded service account from env vars")

    if cred is None:
        logger.warning(
            "Firebase Admin SDK not initialised — service account not found. "
            "Drop firebase-service-account.json into the backend/ directory."
        )
        return

    firebase_admin.initialize_app(cred)
    _db = firestore.client()
    logger.info("Firebase initialised (project: %s)", settings.FIREBASE_PROJECT_ID)


def get_db() -> Any:
    if _db is None:
        raise RuntimeError("Firebase not initialised. Call initialize() on startup.")
    return _db


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def verify_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    return auth.verify_id_token(id_token)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def upsert_user(uid: str, email: str, display_name: str = "") -> None:
    db = get_db()
    ref = db.collection("users").document(uid)
    doc = ref.get()
    if not doc.exists:
        ref.set({
            "uid": uid,
            "email": email,
            "displayName": display_name,
            "tier": "free",
            "createdAt": _utcnow(),
        })


def get_user(uid: str) -> Optional[dict]:
    db = get_db()
    doc = get_db().collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

def create_project(owner_uid: str, name: str, description: str = "") -> dict:
    db = get_db()
    now = _utcnow()
    data = {
        "name": name,
        "description": description,
        "ownerId": owner_uid,
        "members": {owner_uid: "admin"},
        "brandCore": None,
        "ingestionStatus": None,
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("projects").document()
    ref.set(data)
    return {"id": ref.id, **data}


def get_project(project_id: str) -> Optional[dict]:
    db = get_db()
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


def list_projects(uid: str) -> list[dict]:
    db = get_db()
    docs = (
        db.collection("projects")
        .where("members." + uid, "in", ["admin", "editor", "viewer"])
        .order_by("updatedAt", direction=firestore.Query.DESCENDING)
        .limit(50)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def update_project(project_id: str, data: dict) -> None:
    db = get_db()
    data["updatedAt"] = _utcnow()
    db.collection("projects").document(project_id).update(data)


def delete_project(project_id: str) -> None:
    db = get_db()
    db.collection("projects").document(project_id).delete()


# ---------------------------------------------------------------------------
# Chats
# ---------------------------------------------------------------------------

def create_chat(project_id: str, name: str = "New Chat") -> dict:
    db = get_db()
    now = _utcnow()
    data = {
        "projectId": project_id,
        "name": name,
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("projects").document(project_id).collection("chats").document()
    ref.set(data)
    return {"id": ref.id, **data}


def get_chat(project_id: str, chat_id: str) -> Optional[dict]:
    db = get_db()
    doc = (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .get()
    )
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


def list_chats(project_id: str) -> list[dict]:
    db = get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("chats")
        .order_by("updatedAt", direction=firestore.Query.DESCENDING)
        .limit(50)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def rename_chat(project_id: str, chat_id: str, name: str) -> None:
    db = get_db()
    db.collection("projects").document(project_id).collection("chats").document(chat_id).update({
        "name": name,
        "updatedAt": _utcnow(),
    })


def delete_chat(project_id: str, chat_id: str) -> None:
    db = get_db()
    db.collection("projects").document(project_id).collection("chats").document(chat_id).delete()


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def save_message(project_id: str, chat_id: str, role: str, content: str) -> dict:
    db = get_db()
    now = _utcnow()
    data = {
        "projectId": project_id,
        "chatId": chat_id,
        "role": role,
        "content": content,
        "createdAt": now,
    }
    ref = (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .collection("messages").document()
    )
    ref.set(data)
    # bump chat updatedAt
    db.collection("projects").document(project_id).collection("chats").document(chat_id).update({
        "updatedAt": now
    })
    return {"id": ref.id, **data}


def list_messages(project_id: str, chat_id: str, limit: int = 50) -> list[dict]:
    db = get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .collection("messages")
        .order_by("createdAt")
        .limit(limit)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]
