"""
Phase 1 Intelligence Services.

Provides:
  - Brand Voice Scorer: score any text against Brand Core
  - Content Performance Predictor: predict engagement before posting
  - Competitive Intelligence: scrape + analyse competitor social profiles
  - Brand Drift Detector: detect when your content drifts off-brand
  - Brand Memory: build context from user feedback for LLM injection
"""

import json
import logging
from typing import Optional

from backend.config import settings
from backend.services.llm_service import get_client, build_brand_core_context

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _parse_json_response(raw: str) -> dict:
    """Strip markdown code fences and parse JSON from a Claude response."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ---------------------------------------------------------------------------
# Brand Voice Scorer
# ---------------------------------------------------------------------------

async def score_brand_voice(text: str, brand_core: dict) -> dict:
    """
    Score a piece of text against the Brand Core.

    Returns a dict with:
      score (0-100), grade (A-F), strengths, issues, suggestions,
      on_brand_words, off_brand_words
    """
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    prompt = f"""You are a brand voice auditor. Score this text against the Brand Core.

BRAND CORE:
{brand_context}

TEXT TO SCORE:
{text}

Return ONLY valid JSON with this exact structure:
{{
  "score": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "summary": <one sentence verdict>,
  "strengths": [<up to 3 specific strengths, referencing actual words/phrases>],
  "issues": [<up to 5 specific issues found, quoting the problematic text>],
  "suggestions": [<up to 3 actionable, specific improvements>],
  "on_brand_words": [<words or phrases that match the brand voice>],
  "off_brand_words": [<words or phrases that conflict with the brand voice>]
}}

Be specific. Reference actual phrases from the text. Score honestly — 50 is average."""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return _parse_json_response(response.content[0].text)


# ---------------------------------------------------------------------------
# Content Performance Predictor
# ---------------------------------------------------------------------------

async def predict_performance(content: str, platform: str, brand_core: dict) -> dict:
    """
    Predict how well content will perform on a given platform.

    Returns: score, prediction, sub-scores, reasons, improvements, best_posting_time
    """
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    prompt = f"""You are a social media performance analyst. Predict how this content will perform.

PLATFORM: {platform}

BRAND CORE:
{brand_context}

CONTENT:
{content}

Return ONLY valid JSON:
{{
  "score": <integer 0-100>,
  "prediction": <"excellent"|"above average"|"average"|"below average"|"poor">,
  "hook_strength": <integer 0-10>,
  "clarity": <integer 0-10>,
  "cta_strength": <integer 0-10>,
  "brand_alignment": <integer 0-10>,
  "estimated_engagement": <"low"|"medium"|"high">,
  "best_posting_time": <e.g. "Tue–Thu, 6–9 PM local time">,
  "reasons": [<up to 4 specific reasons for this prediction>],
  "improvements": [<up to 3 concrete changes that would raise the score>]
}}

Base predictions on real {platform} algorithm behaviour and audience psychology."""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return _parse_json_response(response.content[0].text)


# ---------------------------------------------------------------------------
# Competitive Intelligence
# ---------------------------------------------------------------------------

async def refresh_competitor_intelligence(
    project_id: str,
    competitors: list[dict],
) -> dict:
    """
    Scrape competitor social profiles via Apify, analyse with Claude,
    and store snapshots in Firestore.

    Each competitor dict: { name, instagram?, facebook?, tiktok? }
    Returns a summary of what was refreshed.
    """
    from backend.services import firebase_service
    from backend.services.ingestion.apify_client import (
        scrape_instagram,
        scrape_facebook,
        scrape_tiktok,
    )

    if not settings.APIFY_API_KEY:
        raise ValueError("APIFY_API_KEY is not configured.")

    results = []

    for competitor in competitors[:5]:  # cap at 5 to control cost
        name = competitor.get("name", "Unknown")
        scraped: dict = {"name": name, "platforms": {}}

        if competitor.get("instagram"):
            try:
                data = await scrape_instagram(
                    competitor["instagram"], settings.APIFY_API_KEY, max_posts=15
                )
                scraped["platforms"]["instagram"] = {
                    "posts": data.get("posts", [])[:10],
                    "profile": data.get("profile", {}),
                    "raw_captions": (data.get("raw_captions") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("Instagram scrape failed for %s: %s", name, exc)

        if competitor.get("facebook"):
            try:
                data = await scrape_facebook(competitor["facebook"], settings.APIFY_API_KEY)
                scraped["platforms"]["facebook"] = {
                    "posts": data.get("posts", [])[:10],
                    "name": data.get("name", ""),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("Facebook scrape failed for %s: %s", name, exc)

        if competitor.get("tiktok"):
            try:
                data = await scrape_tiktok(
                    competitor["tiktok"], settings.APIFY_API_KEY, max_videos=10
                )
                scraped["platforms"]["tiktok"] = {
                    "videos": data.get("videos", [])[:10],
                    "top_hashtags": data.get("top_hashtags", []),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("TikTok scrape failed for %s: %s", name, exc)

        if scraped["platforms"]:
            scraped["analysis"] = await _analyse_competitor(name, scraped["platforms"])
            firebase_service.save_competitor_snapshot(project_id, scraped)

        results.append({
            "name": name,
            "platforms_scraped": list(scraped["platforms"].keys()),
        })

    return {"refreshed": results}


async def _analyse_competitor(name: str, platforms: dict) -> dict:
    """Use Claude to extract strategic insights from scraped competitor content."""
    client = get_client()

    content_sections = []
    for platform, data in platforms.items():
        raw = data.get("raw_captions") or data.get("raw_text", "")
        if raw:
            content_sections.append(f"{platform.upper()} CONTENT:\n{raw[:1500]}")

    if not content_sections:
        return {"tone": "Unknown", "key_themes": [], "content_gaps": []}

    combined = "\n\n---\n\n".join(content_sections)

    prompt = f"""Analyse this competitor's social media content and extract strategic intelligence.

COMPETITOR: {name}

THEIR CONTENT:
{combined}

Return ONLY valid JSON:
{{
  "tone": <their voice/tone in 1 sentence>,
  "key_themes": [<up to 5 recurring topics they post about>],
  "posting_style": <brief description of their format and style>,
  "strengths": [<up to 3 things they do well in their content>],
  "weaknesses": [<up to 3 content gaps or weaknesses>],
  "content_gaps": [<up to 3 topics or angles they're NOT covering — opportunities for you>],
  "top_hashtags": [<hashtags they use most>],
  "engagement_patterns": <what type of content gets most engagement>
}}"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {"tone": "Unknown", "key_themes": [], "content_gaps": []}


# ---------------------------------------------------------------------------
# Brand Drift Detector
# ---------------------------------------------------------------------------

async def check_brand_drift(own_content: list[str], brand_core: dict) -> dict:
    """
    Compare recent own content against Brand Core to detect voice drift.

    own_content: list of recent post text strings (most recent first)
    Returns: drift_score, status, issues, recommendations
    """
    if not own_content:
        return {
            "drift_score": 0,
            "status": "no_data",
            "issues": [],
            "recommendations": [],
            "positive_observations": [],
        }

    client = get_client()
    brand_context = build_brand_core_context(brand_core)
    recent_sample = "\n\n---\n\n".join(own_content[:10])

    prompt = f"""You are a brand compliance auditor. Analyse whether this recent content has drifted from the Brand Core.

BRAND CORE:
{brand_context}

RECENT CONTENT (last {min(len(own_content), 10)} posts):
{recent_sample}

Return ONLY valid JSON:
{{
  "drift_score": <integer 0-100, where 0 = perfectly on-brand, 100 = completely off-brand>,
  "status": <"on_track"|"minor_drift"|"significant_drift"|"off_brand">,
  "tone_drift": <true|false>,
  "theme_drift": <true|false>,
  "voice_drift": <true|false>,
  "issues": [<up to 5 specific drift issues, quoting examples>],
  "recommendations": [<up to 4 actions to get back on brand>],
  "positive_observations": [<up to 3 things that are still on-brand>]
}}"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {
            "drift_score": 0,
            "status": "error",
            "issues": ["Analysis failed"],
            "recommendations": [],
            "positive_observations": [],
        }


# ---------------------------------------------------------------------------
# Brand Memory — context builder for LLM injection
# ---------------------------------------------------------------------------

def build_memory_context(memory_items: list[dict]) -> str:
    """
    Convert brand memory feedback items into a system-prompt section.
    Called by llm_service.stream_chat() when building the system prompt.

    Returns an empty string if there are no useful memory items.
    """
    if not memory_items:
        return ""

    lines: list[str] = ["BRAND MEMORY — What LEO has learned from your past corrections:"]

    for item in memory_items[:15]:  # cap to control token usage
        ftype = item.get("type", "")
        original = (item.get("original") or "")[:100]
        edited = (item.get("edited") or "")[:100]
        reason = item.get("reason", "")
        instruction = item.get("instruction", "")

        if ftype == "edit" and original and edited:
            lines.append(f'- CORRECTED: "{original}" → "{edited}"')
        elif ftype == "reject" and original:
            suffix = f" — {reason}" if reason else ""
            lines.append(f'- REJECTED: "{original}"{suffix}')
        elif ftype == "approve" and original:
            lines.append(f'- APPROVED (keep doing this): "{original}"')
        elif ftype == "instruction" and instruction:
            lines.append(f'- ALWAYS: {instruction}')

    if len(lines) == 1:
        return ""

    lines.append(
        "Apply these learnings. Never repeat rejected patterns. "
        "Reinforce approved ones."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Hashtag Research (Phase 4)
# ---------------------------------------------------------------------------

async def research_hashtags(
    topic: str,
    platform: str,
    content: str,
    brand_core: dict,
) -> dict:
    """
    Generate a tiered hashtag strategy for a given topic and platform.

    Returns:
    {
      "tiers": {
        "mega":   [{"tag": "#...", "approx_posts": "50M+"}],
        "large":  [...],
        "medium": [...],
        "niche":  [...]
      },
      "strategy": "<brief posting strategy note>",
      "recommended_mix": "<e.g. 2 mega + 5 large + 8 medium + 5 niche>"
    }
    """
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    content_section = f"\nCONTENT TO HASHTAG:\n{content[:500]}" if content else ""

    prompt = f"""You are a social media hashtag strategist.

BRAND:
{brand_context}

PLATFORM: {platform}
TOPIC: {topic}{content_section}

Generate a comprehensive hashtag strategy with 4 tiers:
- mega: 5-10M+ posts (broad, high visibility, very competitive)
- large: 500k-5M posts (strong reach, moderate competition)
- medium: 50k-500k posts (good engagement, relevant audience)
- niche: <50k posts (highly targeted, your core audience)

For {platform}, recommend the ideal total number and mix.

Return ONLY valid JSON:
{{
  "tiers": {{
    "mega":   [{{"tag": "#tag", "approx_posts": "10M+"}}],
    "large":  [{{"tag": "#tag", "approx_posts": "800k"}}],
    "medium": [{{"tag": "#tag", "approx_posts": "120k"}}],
    "niche":  [{{"tag": "#tag", "approx_posts": "8k"}}]
  }},
  "strategy": "<one sentence on why this mix works for this topic on {platform}>",
  "recommended_mix": "<e.g. 3 mega + 6 large + 8 medium + 5 niche = 22 total>"
}}

Aim for: 5+ per tier. Make tags specific and relevant to the topic."""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {"tiers": {"mega": [], "large": [], "medium": [], "niche": []}, "strategy": "", "recommended_mix": ""}


# ---------------------------------------------------------------------------
# AI Proactive Insights (Phase 4)
# ---------------------------------------------------------------------------

async def generate_insights(
    project_name: str,
    brand_core: dict,
    memory_items: list,
    competitor_snapshots: list,
    analytics: dict,
) -> dict:
    """
    Analyse all available project data and generate 3-5 proactive insights.

    Each insight has:
      type: "warning" | "opportunity" | "tip" | "achievement"
      title: short headline
      body: 1-2 sentence explanation
      action: suggested next step
      priority: "high" | "medium" | "low"
    """
    client = get_client()

    # Build data summary for Claude
    lib = analytics.get("library", {})
    cal = analytics.get("calendar", {})
    mem = analytics.get("memory", {})
    comp = analytics.get("competitors", {})
    top_performers = analytics.get("top_performers", [])

    memory_summary = ""
    if memory_items:
        approvals = sum(1 for m in memory_items if m.get("type") == "approve")
        rejections = sum(1 for m in memory_items if m.get("type") == "reject")
        memory_summary = f"{len(memory_items)} memory signals ({approvals} approvals, {rejections} rejections)"

    competitor_summary = ""
    if competitor_snapshots:
        names = [s.get("name", "?") for s in competitor_snapshots[:3]]
        competitor_summary = f"Tracking: {', '.join(names)}"
        # Include any content gaps as opportunities
        all_gaps = []
        for snap in competitor_snapshots[:3]:
            gaps = (snap.get("analysis") or {}).get("content_gaps", [])
            all_gaps.extend(gaps[:2])
        if all_gaps:
            competitor_summary += f"\nTop content gaps they're missing: {'; '.join(all_gaps[:4])}"

    top_perf_summary = ""
    if top_performers:
        best = top_performers[0]
        top_perf_summary = f"Best performer: {best['platform']} content with {best['engagement_rate']:.1f}% engagement"

    prompt = f"""You are LEO, an AI brand marketing co-pilot. Analyse this brand's data and generate proactive insights.

BRAND: {project_name}

DATA SUMMARY:
- Content Library: {lib.get('total', 0)} items total | {lib.get('by_status', {}).get('draft', 0)} draft, {lib.get('by_status', {}).get('approved', 0)} approved, {lib.get('by_status', {}).get('posted', 0)} posted
- Calendar: {cal.get('upcoming_count', 0)} posts scheduled in next 30 days
- Brand Memory: {memory_summary or "No signals yet"}
- Competitors: {comp.get('count', 0)} tracked | Last analysis: {comp.get('last_analysis', 'Never')}
- {competitor_summary}
- Performance: {top_perf_summary or "No performance data logged yet"}

Platform breakdown: {lib.get('by_platform', {})}

Generate 3-5 sharp, actionable insights that would genuinely help this brand. Be specific — reference actual numbers from the data.

Types:
- "warning": something that needs attention (brand drift, low posting cadence, stale competitor data)
- "opportunity": something they should capitalise on (competitor gaps, top-performing content patterns)
- "tip": a tactical improvement (posting timing, content mix, platform balance)
- "achievement": something going well worth acknowledging

Return ONLY valid JSON:
{{
  "insights": [
    {{
      "type": "warning",
      "title": "<short punchy headline, max 8 words>",
      "body": "<1-2 sentences with specific data references>",
      "action": "<one concrete next step>",
      "priority": "high"
    }}
  ]
}}

Be honest and data-driven. Don't be generic. If data is sparse, focus on what they should do first."""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {"insights": []}
