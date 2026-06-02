import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.services import firebase_service

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    request: Request,
) -> dict:
    """
    FastAPI dependency. Extracts the Firebase ID token from the Authorization
    header, verifies it, and returns the decoded token claims.

    Also stores the verified UID on request.state.uid for downstream use.

    Usage:
        @router.get("/protected")
        async def route(user: CurrentUser):
            return {"uid": user["uid"]}
    """
    token = credentials.credentials
    try:
        decoded = firebase_service.verify_token(token)
        request.state.uid = decoded["uid"]
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
