"""
Shared route dependencies - project access control and tier enforcement.

Project helpers:
    from backend.api.deps import get_project_or_404, assert_member, assert_editor

    @router.get("/{project_id}/something")
    async def my_route(project_id: str, user: CurrentUser):
        project = get_project_or_404(project_id)
        assert_member(project, user["uid"])      # any role
        assert_editor(project, user["uid"])      # editor or admin
        assert_admin(project, user["uid"])       # admin only

Tier helpers:
    from backend.api.deps import require_tier

    @router.post("/{project_id}/deep-research")
    async def deep_research(
        project_id: str,
        user: CurrentUser,
        _tier: None = require_tier("agency"),
    ):
        ...
"""

import asyncio
from typing import Callable

from fastapi import Depends, HTTPException, status

from backend.middleware.auth import CurrentUser
from backend.services import firebase_service

# ---------------------------------------------------------------------------
# Tier constants
# ---------------------------------------------------------------------------

TIER_RANK: dict[str, int] = {"free": 0, "pro": 1, "agency": 2}


def get_user_tier(uid: str) -> str:
    """
    Synchronous helper: look up a user's current tier from Firestore.
    Returns 'free' | 'pro' | 'agency'.  Safe to call from sync code;
    wrap with asyncio.to_thread() from async contexts.
    """
    user_doc = firebase_service.get_user(uid) or {}
    return user_doc.get("tier", "free")


def require_tier(minimum_tier: str) -> Callable:
    """
    FastAPI dependency factory.  Returns a dependency that raises HTTP 402
    when the current user's tier is below *minimum_tier*.

    Response body on failure::

        {
            "error": "upgrade_required",
            "required_tier": "pro",
            "current_tier": "free",
            "upgrade_url": "/billing"
        }

    Usage::

        @router.post("/expensive-endpoint")
        async def handler(
            user: CurrentUser,
            _tier: None = require_tier("pro"),
        ):
            ...
    """
    async def _check(user: CurrentUser) -> None:
        tier = await asyncio.to_thread(get_user_tier, user["uid"])
        if TIER_RANK.get(tier, 0) < TIER_RANK.get(minimum_tier, 0):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "upgrade_required",
                    "required_tier": minimum_tier,
                    "current_tier": tier,
                    "upgrade_url": "/billing",
                },
            )

    return Depends(_check)

# Role hierarchy: higher index = more permissions.
_ROLE_RANK = {"viewer": 0, "editor": 1, "admin": 2}


def get_project_or_404(project_id: str) -> dict:
    """
    Fetch a project from Firestore and return it.
    Raises HTTP 404 if the project does not exist.
    """
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


def assert_member(project: dict, uid: str, required_role: str = "viewer") -> None:
    """
    Assert the user is a project member with at least required_role.

    Raises HTTP 403 if:
      - uid is not in the project's members map, OR
      - the user's role rank is below required_role.

    Args:
        project:       Project dict (must contain a 'members' key).
        uid:           Firebase UID to check.
        required_role: Minimum role string. One of 'viewer', 'editor', 'admin'.
    """
    members: dict = project.get("members", {})
    user_role = members.get(uid)

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied - not a project member.",
        )

    if _ROLE_RANK.get(user_role, -1) < _ROLE_RANK.get(required_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions - {required_role} or higher required.",
        )


def assert_editor(project: dict, uid: str) -> None:
    """Shorthand for assert_member(project, uid, required_role='editor')."""
    assert_member(project, uid, required_role="editor")


def assert_admin(project: dict, uid: str) -> None:
    """Shorthand for assert_member(project, uid, required_role='admin')."""
    assert_member(project, uid, required_role="admin")


def get_project_as_member(project_id: str, uid: str) -> dict:
    """
    Fetch a project and assert the user is any kind of member.
    Convenience wrapper - equivalent to:
        project = get_project_or_404(project_id)
        assert_member(project, uid)
        return project
    """
    project = get_project_or_404(project_id)
    assert_member(project, uid)
    return project


def get_project_as_editor(project_id: str, uid: str) -> dict:
    """
    Fetch a project and assert the user has editor or admin role.
    Convenience wrapper for the most common mutating-operation gate.
    """
    project = get_project_or_404(project_id)
    assert_editor(project, uid)
    return project


def get_project_as_admin(project_id: str, uid: str) -> dict:
    """
    Fetch a project and assert the user has admin role.
    Used for sensitive operations like member management.
    """
    project = get_project_or_404(project_id)
    assert_admin(project, uid)
    return project
