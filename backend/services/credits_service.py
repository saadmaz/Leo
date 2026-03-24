"""
Credits system — usage-based token economy for LEO.

Each action deducts credits from the user's balance.
Free users get 100 credits/day (resets at midnight UTC).
Pro users get 3,000 credits/month.
Agency users get 15,000 credits/month.
"""
from __future__ import annotations

import datetime
import logging
import time

from fastapi import HTTPException, status

from backend.services import firebase_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Credit costs per action
# ---------------------------------------------------------------------------

CREDIT_COSTS: dict[str, int] = {
    "chat_message":        2,
    "bulk_generate_item":  3,
    "campaign_generate":  20,
    "image_generate":     15,   # per variant (3 variants = 45)
    "deep_search":        25,
    "content_plan":       10,
    "brand_ingestion":    30,
    "competitor_report":  40,
}

# ---------------------------------------------------------------------------
# Plan allotments
# ---------------------------------------------------------------------------

PLAN_CREDITS: dict[str, dict] = {
    "free":   {"amount": 100,   "period": "daily"},
    "pro":    {"amount": 3000,  "period": "monthly"},
    "agency": {"amount": 15000, "period": "monthly"},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _next_reset_ts(period: str) -> int:
    """Return the next reset Unix timestamp for a given period."""
    if period == "daily":
        tomorrow = (
            datetime.datetime.now(datetime.timezone.utc)
            .replace(hour=0, minute=0, second=0, microsecond=0)
            + datetime.timedelta(days=1)
        )
        return int(tomorrow.timestamp())
    else:
        # Monthly — 30 days from now
        return int(time.time()) + 30 * 24 * 3600


def _bootstrap_credits(uid: str, plan: str) -> dict:
    """Initialise credits for a new user or after a reset."""
    config = PLAN_CREDITS.get(plan, PLAN_CREDITS["free"])
    data = {
        "balance": config["amount"],
        "resetsAt": _next_reset_ts(config["period"]),
        "lifetimeUsed": 0,
    }
    firebase_service.update_user_credits(uid, data)
    return data


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_credits(uid: str) -> dict:
    """
    Return the current credit state for a user.
    Auto-bootstraps and auto-resets if the period has elapsed.
    """
    user = firebase_service.get_user(uid) or {}
    plan = user.get("tier", "free")
    config = PLAN_CREDITS.get(plan, PLAN_CREDITS["free"])
    credits = user.get("credits", {})

    # Bootstrap if never initialised
    if not credits or "balance" not in credits:
        credits = _bootstrap_credits(uid, plan)

    # Auto-reset if past the reset timestamp
    resets_at = credits.get("resetsAt", 0)
    try:
        if int(resets_at) < int(time.time()):
            new_balance = config["amount"]
            new_resets_at = _next_reset_ts(config["period"])
            firebase_service.update_user_credits(uid, {
                "balance": new_balance,
                "resetsAt": new_resets_at,
            })
            credits["balance"] = new_balance
            credits["resetsAt"] = new_resets_at
    except (ValueError, TypeError):
        pass

    return {
        "balance": credits.get("balance", config["amount"]),
        "resetsAt": credits.get("resetsAt", 0),
        "lifetimeUsed": credits.get("lifetimeUsed", 0),
        "plan": plan,
        "planAllotment": config["amount"],
        "period": config["period"],
        "costs": CREDIT_COSTS,
    }


def check_and_deduct(uid: str, action: str, quantity: int = 1) -> None:
    """
    Verify the user has enough credits for `action` × `quantity`, then deduct.
    Raises HTTP 402 if the balance is insufficient.
    Non-fatal errors (Firestore write failure) are logged but not raised.
    """
    cost_per = CREDIT_COSTS.get(action, 1)
    total_cost = cost_per * quantity

    user = firebase_service.get_user(uid) or {}
    plan = user.get("tier", "free")
    config = PLAN_CREDITS.get(plan, PLAN_CREDITS["free"])
    credits = user.get("credits", {})

    # Bootstrap or reset if needed
    balance = credits.get("balance")
    resets_at = credits.get("resetsAt", 0)

    if balance is None:
        credits = _bootstrap_credits(uid, plan)
        balance = credits["balance"]
    else:
        try:
            if int(resets_at) < int(time.time()):
                new_balance = config["amount"]
                new_resets_at = _next_reset_ts(config["period"])
                firebase_service.update_user_credits(uid, {
                    "balance": new_balance,
                    "resetsAt": new_resets_at,
                })
                balance = new_balance
        except (ValueError, TypeError):
            pass

    if balance < total_cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "insufficient_credits",
                "message": (
                    f"Not enough credits. This action costs {total_cost} credits "
                    f"but you only have {balance}."
                ),
                "needed": total_cost,
                "have": balance,
                "action": action,
                "plan": plan,
            },
        )

    try:
        firebase_service.deduct_user_credits(uid, total_cost)
    except Exception as exc:
        logger.warning("Failed to deduct %d credits for uid %s: %s", total_cost, uid, exc)


def add_credits(uid: str, amount: int, reason: str = "") -> None:
    """Add credits to a user's balance (admin override, top-up, promotional)."""
    try:
        firebase_service.add_user_credits(uid, amount)
        logger.info("Added %d credits to uid %s (reason: %s)", amount, uid, reason)
    except Exception as exc:
        logger.warning("Failed to add %d credits to uid %s: %s", amount, uid, exc)
