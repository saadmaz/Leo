"""
Image generation service — wraps OpenAI's DALL-E 3 API.

All public functions are async. The openai package is imported lazily so the
server starts cleanly even if OPENAI_API_KEY is absent.
"""
from __future__ import annotations

import logging

from backend.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Size / style mappings
# ---------------------------------------------------------------------------

_SIZE_MAP: dict[str, str] = {
    "square":    "1024x1024",
    "landscape": "1792x1024",
    "portrait":  "1024x1792",
}

_VALID_STYLES = {"vivid", "natural"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_image(
    prompt: str,
    style: str = "vivid",
    aspect_ratio: str = "square",
) -> str:
    """
    Generate an image with DALL-E 3 and return its temporary URL.

    Args:
        prompt:       The image generation prompt (baked-in brand context is
                      expected from the caller).
        style:        "vivid" (hyper-real, dramatic) or "natural" (photorealistic).
        aspect_ratio: "square", "landscape", or "portrait".

    Returns:
        A URL to the generated image (valid for ~1 hour from OpenAI).

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured.
        ValueError:   If generation fails or returns no URL.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. "
            "Add it to backend/.env to enable image generation."
        )

    size = _SIZE_MAP.get(aspect_ratio, "1024x1024")
    dall_e_style = style if style in _VALID_STYLES else "vivid"

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,       # type: ignore[arg-type]
            style=dall_e_style,  # type: ignore[arg-type]
            quality="standard",
            n=1,
        )
        url = response.data[0].url
        if not url:
            raise ValueError("DALL-E returned an empty URL.")
        logger.info("Generated image for prompt (first 80 chars): %.80s", prompt)
        return url
    except RuntimeError:
        raise
    except Exception as exc:
        logger.error("DALL-E image generation failed: %s", exc)
        raise ValueError(f"Image generation failed: {exc}") from exc
