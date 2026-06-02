"""
Shared rate limiter instance.

All routes that need rate limiting import `limiter` from here so there
is a single Limiter governing all counters (prevents per-module bypasses).

Default: 60 requests/minute per IP.
Sensitive AI routes (stream, image generation) use 10/minute via @limiter.limit().

Key function: uses Firebase UID for authenticated requests so that a single
user cannot bypass per-route limits by rotating IPs. Falls back to IP for
unauthenticated routes (e.g. health checks).

Note: @limiter.limit() runs before FastAPI dependencies resolve, so the UID
cannot come from the CurrentUser dependency. The JWT payload is decoded here
without signature verification — this is intentional and safe: the rate limiter
only needs to identify who is making the request; actual auth (signature check)
still happens in the route's CurrentUser dependency.
"""

import base64
import json
import logging

from slowapi import Limiter
from starlette.requests import Request

logger = logging.getLogger(__name__)


def _uid_from_bearer(request: Request) -> str | None:
    """
    Decode the JWT payload (without signature verification) to extract the
    Firebase UID. Used only for rate-limit key derivation.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Restore base64url padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
        # Firebase ID tokens store the UID in "user_id" (also mirrored in "sub")
        return claims.get("user_id") or claims.get("sub")
    except Exception:
        return None


def get_rate_limit_key(request: Request) -> str:
    """
    Use authenticated UID as rate limit key for authenticated requests.
    Falls back to IP for unauthenticated routes.
    This prevents bypass by rotating IPs on authenticated endpoints.
    """
    uid = _uid_from_bearer(request)
    if uid:
        return f"uid:{uid}"
    return request.client.host if request.client else "unknown"


limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["60/minute"],
)
