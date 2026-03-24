"""
Credits routes — balance retrieval and admin top-up.

GET  /credits/balance           — current balance for logged-in user
POST /credits/topup             — admin: add credits to any user
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.middleware.auth import CurrentUser
from backend.middleware.admin_auth import SuperAdminUser
from backend.services import credits_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/credits", tags=["credits"])


class TopupRequest(BaseModel):
    uid: str
    amount: int
    reason: str = ""


@router.get("/balance")
async def get_balance(user: CurrentUser):
    """Return the authenticated user's current credit balance and plan info."""
    return await asyncio.to_thread(credits_service.get_credits, user["uid"])


@router.post("/topup")
async def admin_topup(body: TopupRequest, _admin: SuperAdminUser):
    """Super-admin: manually add credits to a user's account."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
    await asyncio.to_thread(credits_service.add_credits, body.uid, body.amount, body.reason)
    return {"ok": True, "uid": body.uid, "added": body.amount}
