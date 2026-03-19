import json
import logging
from typing import AsyncGenerator, Optional

import anthropic

from backend.config import settings

logger = logging.getLogger(__name__)

_client: Optional[anthropic.AsyncAnthropic] = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set.")
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def build_brand_core_context(brand_core: Optional[dict]) -> str:
    """Convert a Brand Core dict into a concise system-prompt section."""
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
            f"TONE & VOICE: style={tone.get('style','')}, "
            f"formality={tone.get('formality','')}, "
            f"key phrases={tone.get('keyPhrases',[])}."
        )

    visual = brand_core.get("visual") or {}
    if visual:
        sections.append(
            f"VISUAL IDENTITY: primary colour={visual.get('primaryColour','')}, "
            f"secondary colours={visual.get('secondaryColours',[])}, "
            f"fonts={visual.get('fonts',[])}."
        )

    if brand_core.get("themes"):
        sections.append(f"CONTENT THEMES: {', '.join(brand_core['themes'])}.")

    if brand_core.get("tagline"):
        sections.append(f"TAGLINE: {brand_core['tagline']}.")

    messaging = brand_core.get("messaging") or {}
    if messaging.get("valueProp"):
        sections.append(f"VALUE PROPOSITION: {messaging['valueProp']}.")

    if brand_core.get("competitors"):
        sections.append(f"COMPETITORS: {', '.join(brand_core['competitors'])}.")

    return "\n".join(sections) if sections else "Brand Core is incomplete — treat as a general brand."


# ---------------------------------------------------------------------------
# Artifact output instructions
# ---------------------------------------------------------------------------

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
    Stream a Claude response as SSE-formatted chunks.
    Yields strings in the format:  data: {...}\n\n
    """
    client = get_client()

    system_prompt = (
        f"You are LEO, a brand-aware marketing co-pilot for the brand '{project_name}'. "
        "You help marketers create on-brand campaigns, content, copy, and strategy through natural conversation. "
        "Always stay on-brand. Be concise, strategic, and actionable.\n\n"
        "BRAND CORE:\n"
        + build_brand_core_context(brand_core)
        + ARTIFACT_INSTRUCTIONS
    )

    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history[-20:]
    ]
    messages.append({"role": "user", "content": user_message})

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'delta', 'content': text})}\n\n"

        yield "data: [DONE]\n\n"

    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
