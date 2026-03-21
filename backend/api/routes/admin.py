"""
Super-admin routes — /admin/*

All endpoints require the `superAdmin: true` Firebase custom claim.
Never expose these routes publicly; they bypass all per-project ownership checks.

Endpoints:
  GET  /admin/dashboard          — platform-wide stats
  GET  /admin/users              — paginated user list with search
  GET  /admin/users/{uid}        — single user detail
  PATCH /admin/users/{uid}       — update tier / status
  POST /admin/users/{uid}/reset-usage   — reset monthly message counter
  POST /admin/users/{uid}/suspend       — disable Firebase Auth account
  POST /admin/users/{uid}/unsuspend     — re-enable Firebase Auth account
  DELETE /admin/users/{uid}             — permanently delete user
  POST /admin/users/{uid}/override-limits — set custom usage limits
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from backend.middleware.admin_auth import SuperAdminUser
from backend.services import firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UpdateUserRequest(BaseModel):
    tier: Optional[str] = None          # "free" | "pro" | "agency"


class OverrideLimitsRequest(BaseModel):
    messagesLimit: Optional[int] = None
    projectsLimit: Optional[int] = None
    ingestionsLimit: Optional[int] = None
    campaignsLimit: Optional[int] = None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def get_dashboard(_user: SuperAdminUser):
    """
    Return aggregate platform stats for the admin home page:
    user counts by tier, MRR estimate, new signups (last 7 days),
    total projects, and total messages sent this month.
    """
    stats = firebase_service.get_platform_stats()
    return stats


# ---------------------------------------------------------------------------
# Users list
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    _user: SuperAdminUser,
    search: Optional[str] = Query(None, description="Filter by email or display name (case-insensitive)"),
    tier: Optional[str] = Query(None, description="Filter by tier: free | pro | agency"),
    limit: int = Query(200, ge=1, le=500),
):
    """
    Return all users from Firestore.

    Optional filters:
    - `search` — substring match on email or displayName
    - `tier`   — exact tier match
    """
    users = firebase_service.list_all_users(limit=limit)

    if tier:
        users = [u for u in users if u.get("tier") == tier]

    if search:
        q = search.lower()
        users = [
            u for u in users
            if q in (u.get("email") or "").lower()
            or q in (u.get("displayName") or "").lower()
        ]

    # Strip any sensitive internal fields before returning
    return [_safe_user(u) for u in users]


# ---------------------------------------------------------------------------
# Single user
# ---------------------------------------------------------------------------

@router.get("/users/{uid}")
def get_user(uid: str, _user: SuperAdminUser):
    """Return full user profile + project count for the admin detail view."""
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    project_count = firebase_service.get_user_project_count(uid)
    return {**_safe_user(user), "projectCount": project_count}


# ---------------------------------------------------------------------------
# Update tier
# ---------------------------------------------------------------------------

@router.patch("/users/{uid}")
def update_user(uid: str, body: UpdateUserRequest, _user: SuperAdminUser):
    """Update a user's subscription tier."""
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if body.tier:
        valid_tiers = {"free", "pro", "agency"}
        if body.tier not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}",
            )
        firebase_service.set_user_tier(uid, body.tier)
        logger.info("Admin changed tier for %s → %s", uid, body.tier)

    updated = firebase_service.get_user(uid) or {}
    return _safe_user(updated)


# ---------------------------------------------------------------------------
# Reset usage
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/reset-usage")
def reset_usage(uid: str, _user: SuperAdminUser):
    """Reset the user's monthly message counter to zero."""
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.reset_messages_used(uid)
    logger.info("Admin reset message usage for %s", uid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Suspend / unsuspend
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/suspend")
def suspend_user(uid: str, _user: SuperAdminUser):
    """Disable the Firebase Auth account — user can no longer sign in."""
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.suspend_user(uid)
    logger.info("Admin suspended user %s", uid)
    return {"ok": True, "suspended": True}


@router.post("/users/{uid}/unsuspend")
def unsuspend_user(uid: str, _user: SuperAdminUser):
    """Re-enable a previously suspended account."""
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.unsuspend_user(uid)
    logger.info("Admin unsuspended user %s", uid)
    return {"ok": True, "suspended": False}


# ---------------------------------------------------------------------------
# Override limits
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/override-limits")
def override_limits(uid: str, body: OverrideLimitsRequest, _user: SuperAdminUser):
    """
    Persist custom usage limits for a user (bypasses plan defaults).
    Pass only the fields you want to override; omit fields to leave them unchanged.
    """
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    overrides = {k: v for k, v in body.model_dump().items() if v is not None}
    if overrides:
        firebase_service.override_user_limits(uid, overrides)
        logger.info("Admin set limit overrides for %s: %s", uid, overrides)

    return {"ok": True, "overrides": overrides}


# ---------------------------------------------------------------------------
# Delete user
# ---------------------------------------------------------------------------

@router.delete("/users/{uid}")
def delete_user(uid: str, _user: SuperAdminUser):
    """
    Permanently delete the user's Firebase Auth account and Firestore profile.
    Their projects are NOT deleted (they become ownerless in the DB).
    """
    user = firebase_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.delete_user_completely(uid)
    logger.info("Admin permanently deleted user %s", uid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Grant / revoke super admin
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/grant-admin")
def grant_admin(uid: str, _user: SuperAdminUser):
    """Grant the superAdmin custom claim to a user."""
    firebase_service.set_super_admin_claim(uid)
    logger.info("Admin granted superAdmin claim to %s", uid)
    return {"ok": True}


@router.post("/users/{uid}/revoke-admin")
def revoke_admin(uid: str, _user: SuperAdminUser):
    """Revoke the superAdmin custom claim from a user."""
    firebase_service.revoke_super_admin_claim(uid)
    logger.info("Admin revoked superAdmin claim from %s", uid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_user(user: dict) -> dict:
    """
    Return the user dict with keys renamed/structured for the admin API.
    Strips internal Firestore metadata that shouldn't leave the backend.
    """
    billing = user.get("billing", {})
    return {
        "uid": user.get("uid") or user.get("id", ""),
        "email": user.get("email", ""),
        "displayName": user.get("displayName", ""),
        "tier": user.get("tier", "free"),
        "suspended": user.get("suspended", False),
        "createdAt": user.get("createdAt", ""),
        "updatedAt": user.get("updatedAt", ""),
        "billing": {
            "messagesUsed": billing.get("messagesUsed", 0),
            "messagesResetAt": billing.get("messagesResetAt"),
            "ingestionsUsed": billing.get("ingestionsUsed", 0),
            "stripeCustomerId": billing.get("stripeCustomerId"),
            "subscriptionStatus": billing.get("subscriptionStatus"),
            "currentPeriodEnd": billing.get("currentPeriodEnd"),
        },
        "adminOverrides": user.get("adminOverrides", {}),
    }
