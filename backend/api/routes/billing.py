"""
Billing routes - Stripe checkout, portal, webhooks, and usage summary.

Endpoints:
  GET  /billing/status          - current plan + usage for the logged-in user
  POST /billing/checkout        - create Stripe Checkout session
  POST /billing/portal          - create Stripe Customer Portal session
  POST /billing/webhook         - Stripe webhook receiver (no auth)
"""
from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.config import settings
from backend.middleware.auth import CurrentUser
from backend.services import billing_service, firebase_service, stripe_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan: str  # "pro" | "agency"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_billing_status(user: CurrentUser):
    """Return the authenticated user's current plan, usage, and limits."""
    import asyncio
    summary = await asyncio.to_thread(billing_service.get_usage_summary, user["uid"])
    return summary


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, user: CurrentUser, request: Request):
    """Create a Stripe Checkout session and return the redirect URL."""
    if body.plan not in ("pro", "agency"):
        raise HTTPException(status_code=400, detail="Invalid plan. Must be 'pro' or 'agency'.")

    origin = settings.FRONTEND_URL
    success_url = f"{origin}/billing?success=1"
    cancel_url = f"{origin}/billing?cancelled=1"

    import asyncio
    try:
        url = await asyncio.to_thread(
            stripe_service.create_checkout_session,
            user["uid"],
            user.get("email", ""),
            body.plan,
            success_url,
            cancel_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except stripe.error.StripeError as exc:
        logger.error("Stripe checkout error: %s", exc)
        raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")

    return {"url": url}


@router.post("/portal")
async def create_portal(user: CurrentUser):
    """Create a Stripe Customer Portal session for subscription management."""
    return_url = f"{settings.FRONTEND_URL}/billing"

    import asyncio
    try:
        url = await asyncio.to_thread(
            stripe_service.create_portal_session,
            user["uid"],
            user.get("email", ""),
            return_url,
        )
    except stripe.error.StripeError as exc:
        logger.error("Stripe portal error: %s", exc)
        raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")

    return {"url": url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """
    Receive and process Stripe webhook events.

    Handled event types:
      checkout.session.completed        - new subscription purchase → set tier
      customer.subscription.updated     - plan change / renewal → sync tier
      customer.subscription.deleted     - cancellation → downgrade to free
      customer.subscription.paused      - voluntary pause → downgrade to free
      customer.subscription.resumed     - resume from pause → restore tier
      invoice.payment_failed            - first payment failure → mark past_due
      invoice.paid                      - successful charge → ensure tier is active
    """
    payload = await request.body()

    try:
        event = await __import__("asyncio").to_thread(
            stripe_service.construct_webhook_event,
            payload,
            stripe_signature or "",
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook: invalid signature")
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")
    except RuntimeError as exc:
        # STRIPE_WEBHOOK_SECRET not configured — log but don't crash.
        logger.warning("Stripe webhook not verified: %s", exc)
        import json
        event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)

    await _handle_event(event)
    return {"received": True}


async def _resolve_uid(data: dict) -> str | None:
    """
    Try to resolve a Firebase UID from a Stripe event data object.

    Resolution order:
      1. data.metadata.firebase_uid  (set on subscriptions/checkout sessions)
      2. Customer.metadata.firebase_uid  (set when the customer was created)
      3. Customer.metadata.uid  (legacy alias)
      4. Firestore users collection lookup by customer email
    """
    uid = data.get("metadata", {}).get("firebase_uid")
    if uid:
        return uid
    customer_id = data.get("customer")
    if not customer_id:
        return None
    try:
        import asyncio
        import stripe as _stripe
        customer = await asyncio.to_thread(_stripe.Customer.retrieve, customer_id)

        # Primary metadata keys
        meta = customer.get("metadata") or {}
        uid = meta.get("firebase_uid") or meta.get("uid")
        if uid:
            return uid

        # Email fallback — look up the user in Firestore by email
        email = customer.get("email")
        if email:
            db = firebase_service.get_db()
            users = await asyncio.to_thread(
                lambda: list(
                    db.collection("users")
                    .where("email", "==", email)
                    .limit(1)
                    .stream()
                )
            )
            if users:
                return users[0].id

        return None
    except Exception as exc:
        logger.error("UID resolution failed for customer %s: %s", customer_id, exc)
        return None


async def _handle_event(event: stripe.Event) -> None:
    import asyncio

    event_type = event["type"]
    data = event["data"]["object"]

    # ------------------------------------------------------------------
    # New subscription created via Checkout
    # ------------------------------------------------------------------
    if event_type == "checkout.session.completed":
        uid = data.get("metadata", {}).get("firebase_uid")
        plan = data.get("metadata", {}).get("plan")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")

        if uid and plan:
            await asyncio.to_thread(
                firebase_service.update_user_billing,
                uid,
                {
                    "stripeCustomerId": customer_id,
                    "stripeSubscriptionId": subscription_id,
                    "subscriptionStatus": "active",
                },
            )
            await asyncio.to_thread(firebase_service.set_user_tier, uid, plan)
            logger.info("Upgraded uid=%s to plan=%s via checkout", uid, plan)

    # ------------------------------------------------------------------
    # Subscription modified (plan change, renewal, status change)
    # ------------------------------------------------------------------
    elif event_type == "customer.subscription.updated":
        uid = await _resolve_uid(data)
        if uid:
            status_val = data.get("status", "active")
            plan = stripe_service.plan_from_subscription(data)
            updates: dict = {"subscriptionStatus": status_val}
            if data.get("current_period_end"):
                updates["currentPeriodEnd"] = data["current_period_end"]
                updates["messagesResetAt"] = data["current_period_end"]
            await asyncio.to_thread(firebase_service.update_user_billing, uid, updates)
            if plan:
                await asyncio.to_thread(firebase_service.set_user_tier, uid, plan)
            logger.info(
                "Updated subscription uid=%s status=%s plan=%s",
                uid, status_val, plan,
            )

    # ------------------------------------------------------------------
    # Subscription cancelled entirely
    # ------------------------------------------------------------------
    elif event_type == "customer.subscription.deleted":
        uid = await _resolve_uid(data)
        if uid:
            await asyncio.to_thread(firebase_service.set_user_tier, uid, "free")
            await asyncio.to_thread(
                firebase_service.update_user_billing,
                uid,
                {"subscriptionStatus": "cancelled"},
            )
            logger.info("Downgraded uid=%s to free (subscription cancelled)", uid)

    # ------------------------------------------------------------------
    # Subscription paused (Stripe pause_collection feature)
    # ------------------------------------------------------------------
    elif event_type == "customer.subscription.paused":
        uid = await _resolve_uid(data)
        if uid:
            await asyncio.to_thread(firebase_service.set_user_tier, uid, "free")
            await asyncio.to_thread(
                firebase_service.update_user_billing,
                uid,
                {"subscriptionStatus": "paused"},
            )
            logger.info("Downgraded uid=%s to free (subscription paused)", uid)

    # ------------------------------------------------------------------
    # Subscription resumed from pause
    # ------------------------------------------------------------------
    elif event_type == "customer.subscription.resumed":
        uid = await _resolve_uid(data)
        if uid:
            plan = stripe_service.plan_from_subscription(data)
            await asyncio.to_thread(
                firebase_service.update_user_billing,
                uid,
                {"subscriptionStatus": "active"},
            )
            if plan:
                await asyncio.to_thread(firebase_service.set_user_tier, uid, plan)
            logger.info(
                "Restored uid=%s to plan=%s (subscription resumed)", uid, plan
            )

    # ------------------------------------------------------------------
    # Invoice payment failed — mark as past_due but keep tier for now.
    # Stripe will retry; tier is only removed on subscription.deleted.
    # ------------------------------------------------------------------
    elif event_type == "invoice.payment_failed":
        subscription_id = data.get("subscription")
        if subscription_id:
            try:
                import stripe as _stripe
                sub = await asyncio.to_thread(_stripe.Subscription.retrieve, subscription_id)
                uid = await _resolve_uid(sub)
                if uid:
                    await asyncio.to_thread(
                        firebase_service.update_user_billing,
                        uid,
                        {"subscriptionStatus": "past_due"},
                    )
                    logger.warning(
                        "Payment failed for uid=%s subscription=%s",
                        uid, subscription_id,
                    )
            except Exception as exc:
                logger.warning("Failed to handle payment_failed for sub %s: %s", subscription_id, exc)

    # ------------------------------------------------------------------
    # Invoice paid — ensure tier reflects the active subscription.
    # Handles recovery after a past_due → paid transition.
    # ------------------------------------------------------------------
    elif event_type == "invoice.paid":
        subscription_id = data.get("subscription")
        if subscription_id:
            try:
                import stripe as _stripe
                sub = await asyncio.to_thread(_stripe.Subscription.retrieve, subscription_id)
                uid = await _resolve_uid(sub)
                plan = stripe_service.plan_from_subscription(sub)
                if uid and plan:
                    await asyncio.to_thread(
                        firebase_service.update_user_billing,
                        uid,
                        {"subscriptionStatus": "active"},
                    )
                    await asyncio.to_thread(firebase_service.set_user_tier, uid, plan)
                    logger.info(
                        "Payment recovered — restored uid=%s to plan=%s", uid, plan
                    )
            except Exception as exc:
                logger.warning("Failed to handle invoice.paid for sub %s: %s", subscription_id, exc)
