"""
Super-admin routes — /admin/*

All endpoints require the `superAdmin: true` Firebase custom claim.
Never expose these routes publicly; they bypass all per-project ownership checks.

Endpoints:
  GET  /admin/dashboard                    — platform-wide stats
  GET  /admin/analytics                    — charts data (signups, usage histogram, top users)
  GET  /admin/audit-log                    — recent admin actions
  GET  /admin/users                        — user list with search + tier filter
  GET  /admin/users/{uid}                  — single user detail
  PATCH /admin/users/{uid}                 — update tier
  POST /admin/users/{uid}/reset-usage      — reset monthly message counter
  POST /admin/users/{uid}/suspend          — disable Firebase Auth account
  POST /admin/users/{uid}/unsuspend        — re-enable Firebase Auth account
  POST /admin/users/{uid}/override-limits  — set custom usage limits
  POST /admin/users/{uid}/grant-admin      — grant superAdmin claim
  POST /admin/users/{uid}/revoke-admin     — revoke superAdmin claim
  DELETE /admin/users/{uid}               — permanently delete user
  GET  /admin/projects                     — all projects across all users
  DELETE /admin/projects/{project_id}      — deep-delete a project
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
    """Return aggregate platform stats for the admin home page."""
    return firebase_service.get_platform_stats()


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics")
def get_analytics(_user: SuperAdminUser):
    """
    Return analytics data:
    - Daily signup counts (last 30 days)
    - Top 10 users by messages used this month
    - Usage histogram (user count per message-volume bucket)
    """
    return firebase_service.get_analytics()


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit-log")
def get_audit_log(_user: SuperAdminUser, limit: int = Query(200, ge=1, le=500)):
    """Return the most recent admin audit log entries, newest first."""
    return firebase_service.list_audit_logs(limit=limit)


# ---------------------------------------------------------------------------
# Users list
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    _user: SuperAdminUser,
    search: Optional[str] = Query(None, description="Filter by email or display name"),
    tier: Optional[str] = Query(None, description="Filter by tier: free | pro | agency"),
    limit: int = Query(200, ge=1, le=500),
):
    """Return all users from Firestore with optional search and tier filter."""
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
def update_user(uid: str, body: UpdateUserRequest, user: SuperAdminUser):
    """Update a user's subscription tier."""
    target = firebase_service.get_user(uid)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if body.tier:
        valid_tiers = {"free", "pro", "agency"}
        if body.tier not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}",
            )
        old_tier = target.get("tier", "free")
        firebase_service.set_user_tier(uid, body.tier)
        firebase_service.write_audit_log(
            admin_uid=user["uid"],
            action="change_tier",
            target_uid=uid,
            details={"from": old_tier, "to": body.tier},
        )
        logger.info("Admin %s changed tier for %s: %s → %s", user["uid"], uid, old_tier, body.tier)

    return _safe_user(firebase_service.get_user(uid) or {})


# ---------------------------------------------------------------------------
# Reset usage
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/reset-usage")
def reset_usage(uid: str, user: SuperAdminUser):
    """Reset the user's monthly message counter to zero."""
    if not firebase_service.get_user(uid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.reset_messages_used(uid)
    firebase_service.write_audit_log(
        admin_uid=user["uid"], action="reset_usage", target_uid=uid
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Suspend / unsuspend
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/suspend")
def suspend_user(uid: str, user: SuperAdminUser):
    """Disable the Firebase Auth account — user can no longer sign in."""
    if not firebase_service.get_user(uid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.suspend_user(uid)
    firebase_service.write_audit_log(
        admin_uid=user["uid"], action="suspend_user", target_uid=uid
    )
    return {"ok": True, "suspended": True}


@router.post("/users/{uid}/unsuspend")
def unsuspend_user(uid: str, user: SuperAdminUser):
    """Re-enable a previously suspended account."""
    if not firebase_service.get_user(uid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.unsuspend_user(uid)
    firebase_service.write_audit_log(
        admin_uid=user["uid"], action="unsuspend_user", target_uid=uid
    )
    return {"ok": True, "suspended": False}


# ---------------------------------------------------------------------------
# Override limits
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/override-limits")
def override_limits(uid: str, body: OverrideLimitsRequest, user: SuperAdminUser):
    """Persist custom usage limits for a user (bypasses plan defaults)."""
    if not firebase_service.get_user(uid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    overrides = {k: v for k, v in body.model_dump().items() if v is not None}
    if overrides:
        firebase_service.override_user_limits(uid, overrides)
        firebase_service.write_audit_log(
            admin_uid=user["uid"],
            action="override_limits",
            target_uid=uid,
            details={"overrides": overrides},
        )

    return {"ok": True, "overrides": overrides}


# ---------------------------------------------------------------------------
# Delete user
# ---------------------------------------------------------------------------

@router.delete("/users/{uid}")
def delete_user(uid: str, user: SuperAdminUser):
    """Permanently delete the user's Firebase Auth account and Firestore profile."""
    target = firebase_service.get_user(uid)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    firebase_service.write_audit_log(
        admin_uid=user["uid"],
        action="delete_user",
        target_uid=uid,
        details={"email": target.get("email", ""), "tier": target.get("tier", "free")},
    )
    firebase_service.delete_user_completely(uid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Grant / revoke super admin
# ---------------------------------------------------------------------------

@router.post("/users/{uid}/grant-admin")
def grant_admin(uid: str, user: SuperAdminUser):
    """Grant the superAdmin custom claim to a user."""
    firebase_service.set_super_admin_claim(uid)
    firebase_service.write_audit_log(
        admin_uid=user["uid"], action="grant_admin", target_uid=uid
    )
    return {"ok": True}


@router.post("/users/{uid}/revoke-admin")
def revoke_admin(uid: str, user: SuperAdminUser):
    """Revoke the superAdmin custom claim from a user."""
    firebase_service.revoke_super_admin_claim(uid)
    firebase_service.write_audit_log(
        admin_uid=user["uid"], action="revoke_admin", target_uid=uid
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_projects(
    _user: SuperAdminUser,
    search: Optional[str] = Query(None, description="Filter by project name"),
    limit: int = Query(200, ge=1, le=500),
):
    """Return all projects across all users."""
    projects = firebase_service.list_all_projects(limit=limit)

    if search:
        q = search.lower()
        projects = [p for p in projects if q in (p.get("name") or "").lower()]

    return [_safe_project(p) for p in projects]


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, user: SuperAdminUser):
    """Deep-delete a project and all its chats/messages."""
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    firebase_service.write_audit_log(
        admin_uid=user["uid"],
        action="delete_project",
        target_uid=project.get("ownerId", ""),
        details={"projectId": project_id, "projectName": project.get("name", "")},
    )
    firebase_service.delete_project_deep(project_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_user(user: dict) -> dict:
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


def _safe_project(project: dict) -> dict:
    return {
        "id": project.get("id", ""),
        "name": project.get("name", ""),
        "description": project.get("description", ""),
        "ownerId": project.get("ownerId", ""),
        "memberCount": len(project.get("members", {})),
        "ingestionStatus": project.get("ingestionStatus"),
        "websiteUrl": project.get("websiteUrl"),
        "hasBrandCore": project.get("brandCore") is not None,
        "createdAt": project.get("createdAt", ""),
        "updatedAt": project.get("updatedAt", ""),
    }
