"""
Assets route — handles project asset uploads (logo, etc.).

Logos are stored as base64 data URLs directly in Firestore, consistent with
how generated images are handled throughout the codebase. If Cloudflare R2
is configured via environment variables, uploads are routed there instead.

Endpoints:
  POST /projects/{project_id}/assets/logo
    Accepts multipart/form-data with a 'file' field (image/*).
    Returns: { "url": "data:image/...;base64,..." }
"""

import base64
import logging
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, UploadFile, File

from backend.api.deps import get_project_or_404, assert_editor
from backend.config import settings
from backend.middleware.auth import CurrentUser
from backend.services import firebase_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["assets"])

_ALLOWED_MIME_PREFIXES = ("image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml")
_MAX_LOGO_BYTES = 5 * 1024 * 1024  # 5 MB


def _get_r2_client():
    """Return a boto3 S3 client configured for Cloudflare R2, or None if unconfigured."""
    if not all([
        settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
        settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        settings.CLOUDFLARE_R2_ENDPOINT,
        settings.CLOUDFLARE_R2_BUCKET_NAME,
    ]):
        return None
    return boto3.client(
        "s3",
        endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT,
        aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


@router.post("/{project_id}/assets/logo")
async def upload_logo(
    project_id: str,
    user: CurrentUser,
    file: UploadFile = File(...),
) -> dict:
    project = get_project_or_404(project_id)
    assert_editor(project, user["uid"])

    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(p) for p in _ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type}'. Upload a PNG, JPEG, GIF, WebP, or SVG.",
        )

    data = await file.read()
    if len(data) > _MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Logo must be ≤ 5 MB.")

    # --- Upload path: R2 if configured, otherwise base64 data URL in Firestore ---
    r2 = _get_r2_client()

    if r2 is not None:
        # R2 path
        _ext_map = {
            "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
            "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
        }
        ext = _ext_map.get(content_type, "png")
        object_key = f"logos/{project_id}/{uuid.uuid4().hex}.{ext}"
        bucket = settings.CLOUDFLARE_R2_BUCKET_NAME
        try:
            r2.put_object(
                Bucket=bucket,
                Key=object_key,
                Body=data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000",
            )
        except (BotoCoreError, ClientError) as exc:
            logger.error("R2 upload failed for project %s: %s", project_id, exc)
            raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc

        endpoint = settings.CLOUDFLARE_R2_ENDPOINT or ""
        if endpoint and settings.CLOUDFLARE_ACCOUNT_ID:
            logo_url = f"{endpoint.rstrip('/')}/{object_key}"
        else:
            logo_url = f"https://{bucket}.{settings.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/{object_key}"
    else:
        # Fallback: store as base64 data URL directly in Firestore
        b64 = base64.b64encode(data).decode("utf-8")
        logo_url = f"data:{content_type};base64,{b64}"
        logger.info("R2 not configured — storing logo as base64 data URL for project %s", project_id)

    try:
        firebase_service.update_project(project_id, {"logoUrl": logo_url})
    except Exception as exc:
        logger.error("Firestore update failed for project %s logo: %s", project_id, exc)
        raise HTTPException(status_code=502, detail="Uploaded but failed to save URL to project.") from exc

    logger.info("Logo saved for project %s", project_id)
    return {"url": logo_url}
