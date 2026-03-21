"""
Shared rate limiter instance.

All routes that need rate limiting import `limiter` from here so there
is a single Limiter governing all counters (prevents per-module bypasses).

Default: 60 requests/minute per IP.
Sensitive AI routes (stream, image generation) use 10/minute via @limiter.limit().
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
)
