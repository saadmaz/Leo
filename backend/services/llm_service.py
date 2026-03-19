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

    tone = brand_core.get("tone", {})
    if tone:
        sections.append(
            f"TONE & VOICE: style={tone.get('style','')}, "
            f"formality={tone.get('formality','')}, "
            f"key phrases={tone.get('keyPhrases',[])}."
        )

    visual = brand_core.get("visual", {})
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

    messaging = brand_core.get("messaging", {})
    if messaging.get("valueProp"):
        sections.append(f"VALUE PROPOSITION: {messaging['valueProp']}.")

    return "\n".join(sections) if sections else "Brand Core is incomplete."


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
        "You surface structured data (colour palettes, campaign briefs, copy variants) as inline cards when relevant. "
        "Always stay on-brand. Be concise, strategic, and actionable.\n\n"
        "BRAND CORE:\n"
        + build_brand_core_context(brand_core)
    )

    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history[-20:]  # last 20 messages for context window management
    ]
    messages.append({"role": "user", "content": user_message})

    try:
        async with client.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'delta', 'content': text})}\n\n"

        yield "data: [DONE]\n\n"

    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
