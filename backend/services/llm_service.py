"""
LLM service — wraps the Anthropic SDK for conversational streaming.

Responsibilities:
  - Singleton AsyncAnthropic client (one per process, thread-safe).
  - Building the system prompt from Brand Core data.
  - Streaming Claude responses as SSE-formatted chunks.
  - Defining the artifact output format Claude is expected to follow.

All model names, token limits, and context window sizes come from
backend.config.settings so they can be changed without a code deploy.
"""

import json
import logging
from typing import AsyncGenerator, Optional

import anthropic

from backend.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

# Module-level client; lazily initialised on first use.
_client: Optional[anthropic.AsyncAnthropic] = None


def get_client() -> anthropic.AsyncAnthropic:
    """
    Return the shared AsyncAnthropic client, creating it on first call.
    Raises RuntimeError if ANTHROPIC_API_KEY is not configured.
    """
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. "
                "Add it to backend/.env or set it as an environment variable."
            )
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


# ---------------------------------------------------------------------------
# Brand Core → system prompt
# ---------------------------------------------------------------------------

def build_brand_core_context(brand_core: Optional[dict]) -> str:
    """
    Serialize a Brand Core dict into a concise system-prompt section.

    If brand_core is None or empty, returns a guidance string that nudges
    the user towards setting one up rather than silently ignoring it.
    """
    if not brand_core:
        return (
            "No Brand Core has been set up for this project yet. "
            "When the user asks you to analyse their brand, guide them to provide "
            "their website URL or social media links so you can build one."
        )

    sections: list[str] = []

    tone = brand_core.get("tone") or {}
    if tone:
        sections.append(
            f"TONE & VOICE: style={tone.get('style', '')}, "
            f"formality={tone.get('formality', '')}, "
            f"key phrases={tone.get('keyPhrases', [])}, "
            f"avoided language={tone.get('avoidedLanguage', [])}."
        )

    visual = brand_core.get("visual") or {}
    if visual:
        sections.append(
            f"VISUAL IDENTITY: primary colour={visual.get('primaryColour', '')}, "
            f"secondary colours={visual.get('secondaryColours', [])}, "
            f"fonts={visual.get('fonts', [])}, "
            f"image style={visual.get('imageStyle', '')}."
        )

    if brand_core.get("themes"):
        sections.append(f"CONTENT THEMES: {', '.join(brand_core['themes'])}.")

    if brand_core.get("tagline"):
        sections.append(f"TAGLINE: {brand_core['tagline']}.")

    messaging = brand_core.get("messaging") or {}
    if messaging.get("valueProp"):
        sections.append(f"VALUE PROPOSITION: {messaging['valueProp']}.")
    if messaging.get("keyClaims"):
        sections.append(f"KEY CLAIMS: {', '.join(messaging['keyClaims'])}.")

    audience = brand_core.get("audience") or {}
    if audience.get("demographics"):
        sections.append(f"AUDIENCE: {audience['demographics']}.")

    if brand_core.get("competitors"):
        sections.append(f"COMPETITORS: {', '.join(brand_core['competitors'])}.")

    return "\n".join(sections) if sections else "Brand Core is incomplete — treat as a general brand."


# ---------------------------------------------------------------------------
# Artifact output instructions (injected into every system prompt)
# ---------------------------------------------------------------------------

# This constant defines the structured output format Leo uses for renderable
# UI cards (captions, ad copy, campaign briefs, colour palettes).
# Keep in sync with frontend/src/components/chat/artifact-cards.tsx.
ARTIFACT_INSTRUCTIONS = """\

STRUCTURED OUTPUT — ARTIFACTS:
When you produce structured content (captions, ad copy, campaign briefs, colour palettes),
wrap it in an artifact block so the UI can render it as an interactive card.

Format:
<artifact type="TYPE">
{JSON}
</artifact>

Supported artifact types and their JSON shapes:

type="captions"
{
  "platform": "Instagram" | "LinkedIn" | "Twitter" | "TikTok" | "Facebook",
  "captions": [
    { "text": "...", "hashtags": ["tag1", "tag2"] }
  ]
}

type="ad_copy"
{
  "platform": "Meta" | "Google" | "TikTok" | "LinkedIn" | "X",
  "variants": [
    { "headline": "...", "body": "...", "cta": "..." }
  ]
}

type="campaign_brief"
{
  "name": "...",
  "objective": "...",
  "audience": "...",
  "channels": ["..."],
  "timeline": "...",
  "kpis": ["..."],
  "budget_guidance": "...",
  "key_messages": ["..."]
}

type="colour_palette"
{
  "colours": [
    { "hex": "#XXXXXX", "name": "...", "usage": "..." }
  ]
}

Rules:
- Always use an artifact for captions (5+ items), ad copy, campaign briefs, and colour palettes.
- Place the artifact after a short conversational intro — never instead of it.
- Put ONLY JSON inside the artifact block. No markdown inside the block.
- You may include multiple artifacts in one response if appropriate.
- For everything else (strategy, analysis, explanations), use normal markdown.
"""


# ---------------------------------------------------------------------------
# Streaming chat
# ---------------------------------------------------------------------------

async def stream_chat(
    project_name: str,
    brand_core: Optional[dict],
    history: list[dict],
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Stream a Claude response as SSE-formatted text chunks.

    Each yielded string is a complete SSE line:
        data: {"type": "delta", "content": "..."}\n\n
    The final sentinel is:
        data: [DONE]\n\n

    Args:
        project_name:  Used in the system prompt to keep Leo on-brand.
        brand_core:    Brand Core dict from Firestore (may be None).
        history:       Prior messages in [{"role": ..., "content": ...}] format.
                       Should NOT include the current user_message — it is
                       appended here.
        user_message:  The user's latest message text.

    Yields:
        SSE data lines (strings). Callers should yield them directly into
        a FastAPI StreamingResponse.
    """
    client = get_client()

    system_prompt = (
        f"You are LEO, a brand-aware marketing co-pilot for the brand '{project_name}'. "
        "You help marketers create on-brand campaigns, content, copy, and strategy "
        "through natural conversation. Always stay on-brand. Be concise, strategic, "
        "and actionable.\n\n"
        "BRAND CORE:\n"
        + build_brand_core_context(brand_core)
        + ARTIFACT_INSTRUCTIONS
    )

    # Trim history to the configured context window to control token cost.
    # LLM_CONTEXT_MESSAGES is the number of *prior* turns to include.
    context_window = history[-settings.LLM_CONTEXT_MESSAGES:]

    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in context_window
    ]
    messages.append({"role": "user", "content": user_message})

    try:
        async with client.messages.stream(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=settings.LLM_MAX_TOKENS,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'delta', 'content': text})}\n\n"

        yield "data: [DONE]\n\n"

    except anthropic.APIError as exc:
        logger.error("Anthropic API error during chat stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
