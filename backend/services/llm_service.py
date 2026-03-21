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
from google import genai as google_genai

from backend.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Channel presets — platform-specific constraints injected into system prompt
# ---------------------------------------------------------------------------

CHANNEL_PRESETS: dict[str, dict] = {
    "instagram": {
        "label": "Instagram",
        "constraints": (
            "CHANNEL: Instagram.\n"
            "- Captions: ideally under 150 chars for feed; up to 2,200 for carousel/educational posts.\n"
            "- Use 5–10 focused hashtags. Place them after two blank lines or in the first comment.\n"
            "- Lead with a strong hook in the first line (shown before 'more').\n"
            "- Tone: warm, aspirational, story-driven. Emojis used sparingly.\n"
            "- Reels scripts: hook (0–3 s), value (3–45 s), CTA.\n"
            "- Output captions using the 'captions' artifact type."
        ),
    },
    "linkedin": {
        "label": "LinkedIn",
        "constraints": (
            "CHANNEL: LinkedIn.\n"
            "- Posts: 150–300 words; first 3 lines shown before 'see more' — hook immediately.\n"
            "- Tone: professional, insightful, thought-leadership. First-person works well.\n"
            "- Structure: hook → insight → evidence → CTA.\n"
            "- Limit hashtags to 3–5 relevant ones.\n"
            "- Output posts using the 'captions' artifact type with platform='LinkedIn'."
        ),
    },
    "twitter": {
        "label": "X / Twitter",
        "constraints": (
            "CHANNEL: X (Twitter).\n"
            "- Single tweets: 280 chars max. Be punchy and direct.\n"
            "- Threads: number each tweet (1/, 2/, …). Ideal length: 5–10 tweets.\n"
            "- Tone: conversational, confident. First tweet must stand alone.\n"
            "- Hashtags: 1–2 max.\n"
            "- Output tweets using the 'captions' artifact type with platform='X'."
        ),
    },
    "tiktok": {
        "label": "TikTok",
        "constraints": (
            "CHANNEL: TikTok.\n"
            "- Scripts: hook (0–3 s), content (3–45 s), CTA.\n"
            "- Tone: authentic, energetic, trend-aware. Speak directly to camera.\n"
            "- Captions: short (1–3 lines), 3–5 hashtags.\n"
            "- Output video scripts using the 'video_script' artifact type with platform='TikTok'.\n"
            "- Output post captions using the 'captions' artifact type."
        ),
    },
    "meta_ads": {
        "label": "Meta Ads",
        "constraints": (
            "CHANNEL: Meta Ads (Facebook + Instagram).\n"
            "- Primary text: ≤125 chars without truncation.\n"
            "- Headline: ≤27 chars. Description: ≤27 chars.\n"
            "- Always produce 3+ variants for A/B testing.\n"
            "- Output using the 'ad_copy' artifact type with platform='Meta'."
        ),
    },
    "google_ads": {
        "label": "Google Ads",
        "constraints": (
            "CHANNEL: Google Ads (Search).\n"
            "- RSA: up to 15 headlines (30 chars), 4 descriptions (90 chars).\n"
            "- Headlines must be keyword-relevant. Descriptions highlight USP + CTA.\n"
            "- Output using the 'ad_copy' artifact type with platform='Google'."
        ),
    },
    "email": {
        "label": "Email",
        "constraints": (
            "CHANNEL: Email marketing.\n"
            "- Subject line: 30–50 chars. Preview text: 40–130 chars.\n"
            "- Structure: hook → value → proof → CTA.\n"
            "- One clear primary CTA per email.\n"
            "- Output using the 'email_content' artifact type (subject, previewText, body, cta)."
        ),
    },
}

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

# Module-level clients; lazily initialised on first use.
_client: Optional[anthropic.AsyncAnthropic] = None
_gemini_client: Optional[google_genai.Client] = None


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


def get_gemini_client() -> google_genai.Client:
    """
    Return the shared google-genai Client, creating it on first call.
    Used by campaign generation, brand extraction, and image generation.
    Raises RuntimeError if GEMINI_API_KEY is not configured.
    """
    global _gemini_client
    if _gemini_client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Add it to backend/.env to enable Gemini features."
            )
        _gemini_client = google_genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini_client


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

type="content_calendar"
{
  "period": "Week of March 24" | "April 2026" | "...",
  "entries": [
    {
      "day": "Monday",
      "platform": "Instagram" | "LinkedIn" | "X" | "TikTok" | "Facebook" | "Email",
      "content": "...",
      "time": "9:00 AM",
      "hashtags": ["tag1", "tag2"]
    }
  ]
}

type="video_script"
{
  "platform": "TikTok" | "Instagram Reels" | "YouTube Shorts" | "YouTube",
  "duration": "30s" | "60s" | "3–5 min" | "...",
  "scenes": [
    {
      "timestamp": "0:00–0:03",
      "visual": "Description of what to show on screen",
      "audio": "Voiceover / dialogue / music note",
      "caption": "On-screen text overlay (optional)"
    }
  ],
  "hashtags": ["tag1", "tag2"]
}

type="email_content"
{
  "subject": "30–50 char subject line",
  "previewText": "40–130 char preview shown in inbox",
  "body": "Full email body in plain text or light markdown",
  "cta": "Button / link text"
}

type="image_prompt"
{
  "prompt": "Detailed image generation prompt optimised for Imagen 3",
  "style": "vivid" | "natural",
  "aspectRatio": "square" | "landscape" | "portrait",
  "context": "Brief explanation of how this image fits the brand or campaign"
}

Rules:
- Always use an artifact for captions (3+ items), ad copy, campaign briefs, colour palettes, content calendars, video scripts, email content, and image prompts.
- Place the artifact after a short conversational intro — never instead of it.
- Put ONLY JSON inside the artifact block. No markdown inside the block.
- You may include multiple artifacts in one response if appropriate.
- For everything else (strategy, analysis, explanations), use normal markdown.
- When the user asks for an image or visual content, output an image_prompt artifact instead of describing the image — the UI will generate it.
"""


# ---------------------------------------------------------------------------
# Streaming chat
# ---------------------------------------------------------------------------

async def stream_chat(
    project_name: str,
    brand_core: Optional[dict],
    history: list[dict],
    user_message: str,
    channel: Optional[str] = None,
    images: Optional[list] = None,
    model: Optional[str] = None,
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

    channel_section = ""
    if channel and channel in CHANNEL_PRESETS:
        preset = CHANNEL_PRESETS[channel]
        channel_section = f"\n\nCHANNEL CONSTRAINTS:\n{preset['constraints']}"

    system_prompt = (
        f"You are LEO, a brand-aware marketing co-pilot for the brand '{project_name}'. "
        "You help marketers create on-brand campaigns, content, copy, and strategy "
        "through natural conversation. Always stay on-brand. Be concise, strategic, "
        "and actionable.\n\n"
        "BRAND CORE:\n"
        + build_brand_core_context(brand_core)
        + channel_section
        + ARTIFACT_INSTRUCTIONS
    )

    # Trim history to the configured context window to control token cost.
    # LLM_CONTEXT_MESSAGES is the number of *prior* turns to include.
    context_window = history[-settings.LLM_CONTEXT_MESSAGES:]

    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in context_window
    ]

    # Build the final user turn — plain text, or a multi-part content block
    # when image attachments are present (Anthropic vision API).
    if images:
        user_content: list[dict] = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img["mediaType"],
                    "data": img["base64"],
                },
            }
            for img in images
        ]
        user_content.append({"type": "text", "text": user_message})
    else:
        user_content = user_message  # type: ignore[assignment]

    messages.append({"role": "user", "content": user_content})

    try:
        async with client.messages.stream(
            model=model or settings.LLM_CHAT_MODEL,
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
