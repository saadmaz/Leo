"""
Brand Core extractor — sends scraped content to Claude and gets back a
structured BrandCore JSON object.
"""

import json
import logging
import re
from typing import Any

import anthropic

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM = """\
You are a brand intelligence analyst. You will receive raw content scraped from a brand's
digital presence (website, Instagram captions, bio, etc.) and must extract a structured
Brand Core profile.

Return ONLY a valid JSON object — no markdown fences, no explanation, nothing else.
The JSON must match this exact schema:

{
  "tone": {
    "style": "string — e.g. 'playful', 'authoritative', 'conversational'",
    "formality": "string — 'informal' | 'semi-formal' | 'formal'",
    "keyPhrases": ["up to 6 recurring phrases or slogans"],
    "avoidedLanguage": ["up to 4 words/phrases the brand avoids or dislikes"]
  },
  "visual": {
    "primaryColour": "HEX code e.g. #1A73E8 — best guess from content or null",
    "secondaryColours": ["up to 4 HEX codes or empty array"],
    "fonts": ["font names detected or empty array"],
    "imageStyle": "string — e.g. 'clean product photography', 'bold lifestyle', 'minimalist'"
  },
  "themes": ["up to 8 recurring content themes or topics"],
  "tagline": "string — the brand's primary tagline or null",
  "messaging": {
    "valueProp": "string — core value proposition in one sentence",
    "keyClaims": ["up to 5 key brand claims or benefits"]
  },
  "audience": {
    "demographics": "string — age range, gender, income, location if detectable",
    "interests": ["up to 6 interest or lifestyle categories"]
  },
  "competitors": ["up to 5 competitor brand names if mentioned or inferable"]
}

Rules:
- If a field cannot be determined from the content, use null for strings and [] for arrays.
- Infer colours from hex codes mentioned, CSS colour names, or explicit mentions.
- Extract real phrases verbatim from captions/copy — do not invent.
- Be concise: value propositions should be 1 sentence, themes should be 2-4 words each.
"""


async def extract_brand_core(scraped_data: list[dict], api_key: str) -> dict:
    """
    Takes a list of scraped source dicts (website, instagram, etc.)
    and returns a parsed BrandCore dict.
    """
    combined = _build_combined_content(scraped_data)
    logger.info("Brand extractor: sending %d chars to Claude", len(combined))

    client = anthropic.AsyncAnthropic(api_key=api_key)

    message = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        system=EXTRACTION_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Here is the brand content to analyse:\n\n"
                    f"{combined[:12000]}"  # cap at ~12k chars
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    brand_core = _parse_json(raw)
    logger.info("Brand extractor: extraction complete")
    return brand_core


def _build_combined_content(scraped_data: list[dict]) -> str:
    """Assemble a readable text block from all scraped sources."""
    sections: list[str] = []

    for source in scraped_data:
        src_type = source.get("source_type", "unknown")

        if src_type == "website":
            meta = source.get("metadata", {})
            extract = source.get("extract", {})
            markdown = source.get("markdown", "")

            header = f"=== WEBSITE: {source.get('source_url', '')} ===\n"
            if meta.get("title"):
                header += f"Title: {meta['title']}\n"
            if meta.get("description"):
                header += f"Meta description: {meta['description']}\n"
            if extract:
                header += f"Extracted insights: {json.dumps(extract, ensure_ascii=False)}\n"
            header += f"\nContent:\n{markdown[:4000]}\n"
            sections.append(header)

        elif src_type == "instagram":
            profile = source.get("profile", {})
            captions = source.get("raw_captions", "")

            header = f"=== INSTAGRAM: @{source.get('handle', '')} ===\n"
            if profile.get("biography"):
                header += f"Bio: {profile['biography']}\n"
            if profile.get("full_name"):
                header += f"Full name: {profile['full_name']}\n"
            if profile.get("category"):
                header += f"Category: {profile['category']}\n"
            if captions:
                header += f"\nRecent captions:\n{captions[:4000]}\n"
            sections.append(header)

    return "\n\n".join(sections)


def _parse_json(raw: str) -> dict:
    """Parse Claude's response, stripping any accidental markdown fences."""
    # Remove ```json ... ``` wrappers if present
    clean = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    clean = re.sub(r"\s*```$", "", clean, flags=re.MULTILINE)
    try:
        return json.loads(clean.strip())
    except json.JSONDecodeError as exc:
        logger.error("Brand extractor JSON parse error: %s\nRaw: %s", exc, raw[:500])
        # Return a minimal valid Brand Core rather than crashing
        return {
            "tone": None,
            "visual": None,
            "themes": [],
            "tagline": None,
            "messaging": None,
            "audience": None,
            "competitors": [],
        }
