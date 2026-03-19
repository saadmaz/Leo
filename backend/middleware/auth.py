import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.services import firebase_service

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    FastAPI dependency. Extracts the Firebase ID token from the Authorization
    header, verifies it, and returns the decoded token claims.

    Usage:
        @router.get("/protected")
        async def route(user: CurrentUser):
            return {"uid": user["uid"]}
    """
    token = credentials.credentials
    try:
        decoded = firebase_service.verify_token(token)
        return decoded
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Convenient type alias for route signatures
CurrentUser = Annotated[dict, Depends(get_current_user)]
