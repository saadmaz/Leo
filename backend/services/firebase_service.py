"""
Firebase Admin SDK wrapper — Firestore CRUD for all domain objects.

Design notes:
- All public functions are synchronous. Firestore's Python Admin SDK is
  synchronous; wrap with asyncio.to_thread() if you need true async I/O.
- Timestamps are ISO 8601 UTC strings so they sort lexicographically and
  remain human-readable in the Firestore console.
- Pagination limits are read from settings so they can be tuned without
  a code deploy.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import firebase_admin
from firebase_admin import auth, credentials, firestore

logger = logging.getLogger(__name__)

# Module-level Firestore client. Initialised once by initialize() at startup.
_db: Any = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> str:
    """Return the current UTC time as an ISO 8601 string (timezone-aware)."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def initialize() -> None:
    """
    Bootstrap the Firebase Admin SDK and obtain a Firestore client.

    Called once from the FastAPI lifespan handler. Safe to call multiple
    times — subsequent calls are no-ops if the SDK is already initialised.

    Credential resolution order:
      1. Service account JSON file on disk (FIREBASE_SERVICE_ACCOUNT_PATH)
      2. Inline env vars (FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL)
    """
    global _db
    if firebase_admin._apps:
        # Already initialised (e.g. hot-reload in development).
        _db = firestore.client()
        return

    from backend.config import settings

    cred: Optional[credentials.Base] = None

    # Option 1: service account JSON file on disk.
    sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        logger.info("Firebase: loaded service account from %s", sa_path)

    # Option 2: individual env vars — useful in container/cloud deployments
    # where mounting a file is inconvenient.
    elif settings.FIREBASE_PRIVATE_KEY and settings.FIREBASE_CLIENT_EMAIL:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": settings.FIREBASE_PROJECT_ID,
            # Cloud providers sometimes escape newlines as literal \n in env vars.
            "private_key": settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
            "client_email": settings.FIREBASE_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        logger.info("Firebase: loaded service account from environment variables")

    if cred is None:
        logger.warning(
            "Firebase Admin SDK NOT initialised — no valid credentials found. "
            "Drop firebase-service-account.json into backend/ or set "
            "FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL env vars."
        )
        return

    firebase_admin.initialize_app(cred)
    _db = firestore.client()
    logger.info("Firebase initialised (project: %s)", settings.FIREBASE_PROJECT_ID)


def get_db() -> Any:
    """
    Return the Firestore client. Raises RuntimeError if initialize() was
    never called (indicates a startup misconfiguration).
    """
    if _db is None:
        raise RuntimeError(
            "Firebase not initialised. Ensure initialize() is called during app startup."
        )
    return _db


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def verify_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return the decoded claims dict.
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    return auth.verify_id_token(id_token)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def upsert_user(uid: str, email: str, display_name: str = "") -> None:
    """
    Create the user profile document if it doesn't already exist.
    Uses a get-then-set pattern to avoid overwriting existing data (e.g. tier).
    """
    db = get_db()
    ref = db.collection("users").document(uid)
    if not ref.get().exists:
        ref.set({
            "uid": uid,
            "email": email,
            "displayName": display_name,
            "tier": "free",
            "billing": {
                "messagesUsed": 0,
                "ingestionsUsed": 0,
                "messagesResetAt": _utcnow(),
            },
            "createdAt": _utcnow(),
        })


def set_user_tier(uid: str, tier: str) -> None:
    """Update the user's subscription tier ('free', 'pro', 'agency')."""
    db = get_db()
    db.collection("users").document(uid).update({"tier": tier})


def update_user_billing(uid: str, data: dict) -> None:
    """
    Merge billing metadata into the user's `billing` sub-map.
    Accepts keys like stripeCustomerId, subscriptionStatus, currentPeriodEnd.
    """
    db = get_db()
    updates = {f"billing.{k}": v for k, v in data.items()}
    db.collection("users").document(uid).update(updates)


def increment_messages_used(uid: str) -> None:
    """Atomically increment the user's monthly message counter."""
    db = get_db()
    db.collection("users").document(uid).update(
        {"billing.messagesUsed": firestore.Increment(1)}
    )


def increment_ingestions_used(uid: str) -> None:
    """Atomically increment the user's ingestion counter."""
    db = get_db()
    db.collection("users").document(uid).update(
        {"billing.ingestionsUsed": firestore.Increment(1)}
    )


def reset_messages_used(uid: str) -> None:
    """Reset the monthly message counter when the billing period rolls over."""
    db = get_db()
    db.collection("users").document(uid).update(
        {"billing.messagesUsed": 0, "billing.messagesResetAt": None}
    )


def reset_monthly_usage(uid: str) -> None:
    """Reset message counter at the start of a new billing period."""
    db = get_db()
    db.collection("users").document(uid).update({
        "billing.messagesUsed": 0,
        "billing.messagesResetAt": _utcnow(),
    })


def get_user(uid: str) -> Optional[dict]:
    """Return the user profile dict, or None if the document does not exist."""
    db = get_db()
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

def create_project(
    owner_uid: str,
    name: str,
    description: str = "",
    *,
    website_url: Optional[str] = None,
    instagram_url: Optional[str] = None,
    facebook_url: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    tiktok_url: Optional[str] = None,
    x_url: Optional[str] = None,
    youtube_url: Optional[str] = None,
    threads_url: Optional[str] = None,
    pinterest_url: Optional[str] = None,
    snapchat_url: Optional[str] = None,
    content_model: str = "claude-sonnet-4-6",
    image_model: str = "dall-e-3",
    video_model: str = "gemini-flash",
    prompt_model: str = "claude-opus-4-6",
) -> dict:
    """
    Create a new project owned by owner_uid.
    The owner is automatically added as an 'admin' member.
    Returns the full project dict including the generated Firestore ID.
    """
    db = get_db()
    now = _utcnow()
    data = {
        "name": name,
        "description": description,
        "ownerId": owner_uid,
        # members is a map of uid → role so membership queries stay O(1).
        "members": {owner_uid: "admin"},
        "brandCore": None,
        "ingestionStatus": None,
        # Social links
        "websiteUrl": website_url,
        "instagramUrl": instagram_url,
        "facebookUrl": facebook_url,
        "linkedinUrl": linkedin_url,
        "tiktokUrl": tiktok_url,
        "xUrl": x_url,
        "youtubeUrl": youtube_url,
        "threadsUrl": threads_url,
        "pinterestUrl": pinterest_url,
        "snapchatUrl": snapchat_url,
        # Model settings
        "contentModel": content_model,
        "imageModel": image_model,
        "videoModel": video_model,
        "promptModel": prompt_model,
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("projects").document()
    ref.set(data)
    return {"id": ref.id, **data}


def get_project(project_id: str) -> Optional[dict]:
    """Return the project dict (with 'id' key), or None if it doesn't exist."""
    db = get_db()
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


def list_projects(uid: str) -> list[dict]:
    """
    Return all projects where uid is a member, sorted by updatedAt descending.

    NOTE: Firestore cannot order_by on a field that isn't in the where clause
    when the where clause uses a dynamic key (members.{uid}). We fetch up to
    PROJECTS_LIMIT docs and sort in Python. This is acceptable at current scale;
    revisit with a denormalised index if the limit needs to rise significantly.
    """
    from backend.config import settings

    db = get_db()
    docs = (
        db.collection("projects")
        .where(f"members.{uid}", "in", ["admin", "editor", "viewer"])
        .limit(settings.PROJECTS_LIMIT)
        .stream()
    )
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    return sorted(results, key=lambda p: p.get("updatedAt", ""), reverse=True)


def update_project(project_id: str, data: dict) -> None:
    """
    Partially update a project document.
    Always stamps updatedAt so sort order stays correct.
    """
    db = get_db()
    data["updatedAt"] = _utcnow()
    db.collection("projects").document(project_id).update(data)


def delete_project(project_id: str) -> None:
    """
    Delete a project document.

    WARNING — Firestore does NOT automatically delete subcollections. This
    deletes the top-level document only; chats and messages become orphaned.
    For production, call delete_project_deep() or run a Cloud Function trigger.
    In development, orphaned data is harmless but clutters the console.
    """
    db = get_db()
    db.collection("projects").document(project_id).delete()
    logger.warning(
        "Deleted project %s. Subcollections (chats/messages) were NOT deleted "
        "and remain in Firestore as orphans.", project_id
    )


def delete_project_deep(project_id: str) -> None:
    """
    Delete a project AND all its chats (messages within each chat are still
    orphaned at the messages subcollection level — see NOTE below).

    This is a best-effort client-side cascade. For a true atomic delete,
    use a Firebase Cloud Function with the 'delete-user-data' extension or
    the Admin SDK batch-delete approach.

    NOTE: Recursively deleting deeply nested subcollections (messages inside
    chats) requires iterating each chat, then each message. At scale, prefer
    a server-side solution to avoid timeout issues.
    """
    db = get_db()
    project_ref = db.collection("projects").document(project_id)

    # Delete all chats (and their message subcollections) first.
    chats_ref = project_ref.collection("chats")
    for chat_doc in chats_ref.stream():
        _delete_chat_deep(project_ref, chat_doc.id)

    # Finally delete the project document itself.
    project_ref.delete()
    logger.info("Deep-deleted project %s with all chats.", project_id)


def _delete_chat_deep(project_ref: Any, chat_id: str) -> None:
    """Delete a chat document and all its message documents."""
    chat_ref = project_ref.collection("chats").document(chat_id)
    for msg_doc in chat_ref.collection("messages").stream():
        msg_doc.reference.delete()
    chat_ref.delete()


# ---------------------------------------------------------------------------
# Chats
# ---------------------------------------------------------------------------

def create_chat(project_id: str, name: str = "New Chat") -> dict:
    """Create a chat under a project. Returns the full chat dict with 'id'."""
    db = get_db()
    now = _utcnow()
    data = {
        "projectId": project_id,
        "name": name,
        "createdAt": now,
        "updatedAt": now,
    }
    ref = (
        db.collection("projects").document(project_id)
        .collection("chats").document()
    )
    ref.set(data)
    return {"id": ref.id, **data}


def get_chat(project_id: str, chat_id: str) -> Optional[dict]:
    """Return a chat dict (with 'id'), or None if not found."""
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
    """
    Return all chats for a project, sorted by updatedAt descending.
    Limited to CHATS_LIMIT to avoid runaway reads.
    """
    from backend.config import settings

    db = get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("chats")
        .limit(settings.CHATS_LIMIT)
        .stream()
    )
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    return sorted(results, key=lambda c: c.get("updatedAt", ""), reverse=True)


def rename_chat(project_id: str, chat_id: str, name: str) -> None:
    """Rename a chat and bump its updatedAt timestamp."""
    db = get_db()
    (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .update({"name": name, "updatedAt": _utcnow()})
    )


def delete_chat(project_id: str, chat_id: str) -> None:
    """
    Delete a chat document.
    Messages inside the chat are orphaned — see delete_project_deep() for
    a full recursive delete strategy.
    """
    db = get_db()
    (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .delete()
    )


# ---------------------------------------------------------------------------
# Campaigns   (subcollection: projects/{pid}/campaigns/{cid})
# ---------------------------------------------------------------------------

def create_campaign(project_id: str, data: dict) -> dict:
    """Create a campaign document. Returns the full dict with 'id'."""
    db = get_db()
    now = _utcnow()
    payload = {
        **data,
        "projectId": project_id,
        "status": "generating",
        "contentPacks": {},
        "createdAt": now,
        "updatedAt": now,
    }
    ref = (
        db.collection("projects").document(project_id)
        .collection("campaigns").document()
    )
    ref.set(payload)
    return {"id": ref.id, **payload}


def get_campaign(project_id: str, campaign_id: str) -> Optional[dict]:
    """Return a campaign dict (with 'id'), or None if not found."""
    db = get_db()
    doc = (
        db.collection("projects").document(project_id)
        .collection("campaigns").document(campaign_id)
        .get()
    )
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}


def list_campaigns(project_id: str, limit: int = 50) -> list[dict]:
    """Return all campaigns for a project sorted by createdAt descending."""
    db = get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("campaigns")
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def update_campaign(project_id: str, campaign_id: str, data: dict) -> None:
    """Partially update a campaign document. Bumps updatedAt."""
    db = get_db()
    data["updatedAt"] = _utcnow()
    (
        db.collection("projects").document(project_id)
        .collection("campaigns").document(campaign_id)
        .update(data)
    )


def delete_campaign(project_id: str, campaign_id: str) -> None:
    """Delete a campaign document."""
    db = get_db()
    (
        db.collection("projects").document(project_id)
        .collection("campaigns").document(campaign_id)
        .delete()
    )


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

# Valid roles accepted by save_message. Validated explicitly to prevent
# arbitrary strings being persisted to Firestore and passed to the LLM.
_VALID_ROLES = frozenset({"user", "assistant"})


def save_message(project_id: str, chat_id: str, role: str, content: str) -> dict:
    """
    Persist a chat message and bump the parent chat's updatedAt.

    role must be 'user' or 'assistant'. Raises ValueError for anything else
    so callers don't accidentally store invalid data.
    """
    if role not in _VALID_ROLES:
        raise ValueError(
            f"Invalid message role {role!r}. Must be one of: {sorted(_VALID_ROLES)}"
        )

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

    # Bump chat updatedAt so it floats to the top of the chat list.
    (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .update({"updatedAt": now})
    )
    return {"id": ref.id, **data}


def list_messages(project_id: str, chat_id: str, limit: int = 50) -> list[dict]:
    """
    Return messages for a chat, sorted by createdAt ascending (oldest first).

    limit controls how many messages are returned. The default (50) is
    intentionally conservative; pass a smaller value when building LLM
    context windows to control token cost.
    """
    db = get_db()
    docs = (
        db.collection("projects").document(project_id)
        .collection("chats").document(chat_id)
        .collection("messages")
        .limit(limit)
        .stream()
    )
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    # Sort ascending so the LLM receives messages in chronological order.
    return sorted(results, key=lambda m: m.get("createdAt", ""))
