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
import re
from typing import Optional
from urllib.parse import urlparse

from backend.config import settings
from backend.services.llm_service import get_client, build_brand_core_context


def _logo_url(website: str) -> Optional[str]:
    """Return a Logo.dev image URL for a given website, or None if key missing."""
    if not settings.LOGO_DEV_API_KEY or not website:
        return None
    parsed = urlparse(website if "://" in website else f"https://{website}")
    domain = parsed.netloc.lstrip("www.") or parsed.path.lstrip("www.").split("/")[0]
    if not domain:
        return None
    return f"https://img.logo.dev/{domain}?token={settings.LOGO_DEV_API_KEY}&retina=true"

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

    Each competitor dict: { name, website?, instagram?, facebook?, tiktok?, linkedin?, youtube? }
    Returns a summary of what was refreshed.
    """
    from backend.services import firebase_service
    from backend.services.ingestion.apify_client import (
        scrape_instagram,
        scrape_facebook,
        scrape_tiktok,
        scrape_linkedin,
        scrape_youtube,
        scrape_threads,
    )

    if not settings.APIFY_API_KEY:
        raise ValueError("APIFY_API_KEY is not configured.")

    results = []

    for competitor in competitors[:5]:  # cap at 5 to control cost
        name = competitor.get("name", "Unknown")
        website = competitor.get("website", "")
        scraped: dict = {
            "name": name,
            "platforms": {},
            "website": website,
            "logo_url": _logo_url(website),
        }

        if competitor.get("instagram"):
            try:
                data = await scrape_instagram(
                    competitor["instagram"], settings.APIFY_API_KEY, max_posts=15
                )
                scraped["platforms"]["instagram"] = {
                    "posts": data.get("posts", [])[:10],
                    "profile": data.get("profile", {}),
                    "followers": data.get("profile", {}).get("followers", 0),
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
                    "followers": data.get("likes", 0),
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
                    "followers": data.get("followers", 0),
                    "top_hashtags": data.get("top_hashtags", []),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("TikTok scrape failed for %s: %s", name, exc)

        if competitor.get("linkedin"):
            try:
                data = await scrape_linkedin(competitor["linkedin"], settings.APIFY_API_KEY)
                scraped["platforms"]["linkedin"] = {
                    "posts": data.get("posts", [])[:10],
                    "followers": data.get("followers", 0),
                    "tagline": data.get("tagline", ""),
                    "industry": data.get("industry", ""),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("LinkedIn scrape failed for %s: %s", name, exc)

        if competitor.get("youtube"):
            try:
                data = await scrape_youtube(competitor["youtube"], settings.APIFY_API_KEY, max_videos=10)
                scraped["platforms"]["youtube"] = {
                    "videos": data.get("videos", [])[:10],
                    "channel_name": data.get("channel_name", ""),
                    "subscribers": data.get("subscribers", 0),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("YouTube scrape failed for %s: %s", name, exc)

        if competitor.get("threads"):
            try:
                data = await scrape_threads(competitor["threads"], settings.APIFY_API_KEY)
                scraped["platforms"]["threads"] = {
                    "posts": data.get("posts", [])[:10],
                    "followers": data.get("followers", 0),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
            except Exception as exc:
                logger.warning("Threads scrape failed for %s: %s", name, exc)

        if scraped["platforms"]:
            results.append({
                "name": name,
                "logo_url": scraped.get("logo_url"),
                "platforms_scraped": list(scraped["platforms"].keys()),
                "_scraped": scraped,  # carry for batch analysis below
            })
        else:
            results.append({
                "name": name,
                "logo_url": scraped.get("logo_url"),
                "platforms_scraped": [],
            })

    # Batch-analyse all scraped competitors in a SINGLE Claude call instead of N calls.
    scraped_list = [r.pop("_scraped") for r in results if "_scraped" in r]
    if scraped_list:
        analyses = await _analyse_competitors_batch(scraped_list)
        for scraped in scraped_list:
            scraped["analysis"] = analyses.get(scraped["name"], {"tone": "Unknown", "key_themes": [], "content_gaps": []})
            firebase_service.save_competitor_snapshot(project_id, scraped)

    return {"refreshed": results}


async def _analyse_competitors_batch(scraped_list: list[dict]) -> dict:
    """
    Analyse up to 5 competitors in a SINGLE Claude call.
    Returns dict keyed by competitor name → analysis dict.
    Previously this was N separate calls; batching saves 4 API round-trips.
    """
    client = get_client()

    blocks = []
    for scraped in scraped_list:
        name = scraped["name"]
        content_sections = []
        for platform, data in scraped.get("platforms", {}).items():
            raw = data.get("raw_captions") or data.get("raw_text", "")
            if raw:
                content_sections.append(f"  {platform.upper()}:\n{raw[:800]}")
        if content_sections:
            blocks.append(f"COMPETITOR: {name}\n" + "\n".join(content_sections))

    if not blocks:
        return {}

    competitors_text = "\n\n===\n\n".join(blocks)

    prompt = f"""Analyse each competitor's social media content below. Return ONLY a valid JSON object where each key is the competitor name and the value is their analysis.

{competitors_text}

Return format:
{{
  "<competitor name>": {{
    "tone": "<voice/tone in 1 sentence>",
    "key_themes": ["<up to 5 recurring topics>"],
    "posting_style": "<brief description>",
    "strengths": ["<up to 3>"],
    "weaknesses": ["<up to 3>"],
    "content_gaps": ["<up to 3 opportunities>"],
    "top_hashtags": ["<most used>"],
    "engagement_patterns": "<what gets most engagement>"
  }}
}}"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Competitive Strategy Plan
# ---------------------------------------------------------------------------

async def generate_competitive_strategy(
    brand_core: dict,
    brand_name: str,
    competitor_snapshots: list[dict],
) -> dict:
    """
    Compare brand core vs competitor analyses and produce an actionable
    competitive strategy plan.

    Returns:
      executive_summary, brand_position, competitor_breakdown,
      battlegrounds, action_plan, quick_wins
    """
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    competitors_text = ""
    for snap in competitor_snapshots[:5]:
        analysis = snap.get("analysis") or {}
        web = snap.get("web_analysis") or {}
        platforms = list((snap.get("platforms") or {}).keys())
        competitors_text += f"""
COMPETITOR: {snap.get("name", "?")}
  Platforms: {", ".join(platforms) or "unknown"}
  Tone: {analysis.get("tone", "")}
  Key Themes: {", ".join(analysis.get("key_themes") or [])}
  Strengths: {", ".join(analysis.get("strengths") or [])}
  Weaknesses: {", ".join(analysis.get("weaknesses") or [])}
  Content Gaps They Have: {", ".join(analysis.get("content_gaps") or [])}
  Top Hashtags: {", ".join((analysis.get("top_hashtags") or [])[:8])}
  Market Position: {web.get("market_position", "")}
  Momentum: {web.get("momentum", "")}
"""

    prompt = f"""You are a senior brand strategist. Analyse this brand against its competitors and produce an actionable competitive strategy plan.

OUR BRAND: {brand_name}
{brand_context}

COMPETITORS:
{competitors_text}

Return ONLY valid JSON with this exact structure:
{{
  "executive_summary": "<2-3 sentence summary of our competitive position>",
  "brand_position": {{
    "strengths": [<up to 3 genuine strengths vs competitors>],
    "vulnerabilities": [<up to 3 real risks or gaps vs competitors>],
    "differentiation": "<what makes us genuinely different>"
  }},
  "competitor_breakdown": [
    {{
      "name": "<competitor name>",
      "threat_level": "high|medium|low",
      "what_they_do_better": "<1-2 sentences>",
      "their_weakness": "<1-2 sentences>",
      "how_to_beat_them": "<1-2 sentences specific tactic>"
    }}
  ],
  "battlegrounds": [
    {{
      "area": "<e.g. Short-form video, Educational content, Community>",
      "our_position": "winning|competitive|losing|untapped",
      "recommendation": "<specific action>"
    }}
  ],
  "action_plan": [
    {{
      "priority": "immediate|short_term|long_term",
      "action": "<specific action>",
      "rationale": "<why this matters>",
      "expected_impact": "<what this achieves>"
    }}
  ],
  "quick_wins": [<up to 3 things we can do THIS WEEK to gain competitive edge>]
}}

Be specific. Use competitor names. Reference actual patterns from the data. Make the plan genuinely actionable."""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {
            "executive_summary": "Strategy analysis unavailable.",
            "brand_position": {"strengths": [], "vulnerabilities": [], "differentiation": ""},
            "competitor_breakdown": [],
            "battlegrounds": [],
            "action_plan": [],
            "quick_wins": [],
        }


# ---------------------------------------------------------------------------
# Competitor Deep-Dive Report
# ---------------------------------------------------------------------------

async def generate_competitor_report(
    competitor_snapshot: dict,
    brand_core: dict,
    brand_name: str,
) -> dict:
    """
    Generate a comprehensive deep-dive report on a single competitor.
    Combines scraped social data with Claude's analysis.
    """
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    name = competitor_snapshot.get("name", "Unknown")
    platforms_data = competitor_snapshot.get("platforms") or {}
    analysis = competitor_snapshot.get("analysis") or {}
    web = competitor_snapshot.get("web_analysis") or {}
    web_raw = competitor_snapshot.get("web") or {}

    # Build real follower data from scraped data
    real_metrics: list[dict] = []
    for platform, data in platforms_data.items():
        profile = data.get("profile") or {}
        followers = (
            profile.get("followers") or
            data.get("followers") or
            data.get("likes") or  # facebook page likes
            0
        )
        posts = data.get("posts") or data.get("videos") or []
        total_likes = sum(p.get("likes", 0) for p in posts)
        total_comments = sum(p.get("comments", 0) for p in posts)
        num_posts = len(posts) if posts else 1
        avg_likes = total_likes / num_posts
        avg_comments = total_comments / num_posts
        real_metrics.append({
            "platform": platform,
            "followers": followers,
            "avg_likes": round(avg_likes),
            "avg_comments": round(avg_comments),
        })

    platform_summary = "\n".join(
        f"  {m['platform']}: {m['followers']:,} followers, avg {m['avg_likes']} likes, avg {m['avg_comments']} comments"
        for m in real_metrics
    )

    prompt = f"""You are a senior competitive intelligence analyst. Generate a comprehensive deep-dive report on this competitor for the brand "{brand_name}".

OUR BRAND:
{brand_context}

COMPETITOR: {name}
Website: {competitor_snapshot.get("website", "unknown")}

SCRAPED PLATFORM DATA:
{platform_summary or "No platform data available"}

CONTENT ANALYSIS:
- Tone: {analysis.get("tone", "")}
- Key themes: {", ".join(analysis.get("key_themes") or [])}
- Posting style: {analysis.get("posting_style", "")}
- Strengths: {", ".join(analysis.get("strengths") or [])}
- Weaknesses: {", ".join(analysis.get("weaknesses") or [])}
- Content gaps: {", ".join(analysis.get("content_gaps") or [])}
- Top hashtags: {", ".join((analysis.get("top_hashtags") or [])[:10])}
- Engagement patterns: {analysis.get("engagement_patterns", "")}

WEB INTELLIGENCE:
- Market position: {web.get("market_position", "")}
- Momentum: {web.get("momentum", "stable")}
- Recent moves: {", ".join(web.get("recent_moves") or [])}
- Company summary: {web_raw.get("company_summary", "")}

Return ONLY valid JSON with this exact structure:
{{
  "company_profile": {{
    "description": "<2-3 sentence company overview>",
    "industry": "<industry/sector>",
    "estimated_size": "<e.g. 11-50 employees>",
    "founded_estimate": "<e.g. 2018-2020>",
    "hq_location": "<city, country if knowable>",
    "funding_stage": "<bootstrapped|pre-seed|seed|series-a|series-b|public|unknown>",
    "revenue_range": "<e.g. $1M-$5M estimated ARR>",
    "business_model": "<SaaS|ecommerce|services|marketplace|etc>"
  }},
  "platform_metrics": [
    {{
      "platform": "<platform name>",
      "followers": <integer — use real data if available, otherwise estimate>,
      "is_estimated": <true if you estimated it, false if from real data>,
      "engagement_rate": <float 0-20 — realistic engagement rate %>,
      "posts_per_week": <integer>,
      "avg_likes": <integer>,
      "avg_comments": <integer>,
      "top_content_type": "<e.g. reels, carousels, shorts>"
    }}
  ],
  "growth_trajectory": [
    {{"month": "Oct 2024", "followers_total": <integer>, "engagement_index": <float 1-10>}},
    {{"month": "Nov 2024", "followers_total": <integer>, "engagement_index": <float 1-10>}},
    {{"month": "Dec 2024", "followers_total": <integer>, "engagement_index": <float 1-10>}},
    {{"month": "Jan 2025", "followers_total": <integer>, "engagement_index": <float 1-10>}},
    {{"month": "Feb 2025", "followers_total": <integer>, "engagement_index": <float 1-10>}},
    {{"month": "Mar 2025", "followers_total": <integer>, "engagement_index": <float 1-10>}}
  ],
  "revenue_trajectory": [
    {{"period": "Q2 2024", "value": <integer — estimated monthly revenue in USD>}},
    {{"period": "Q3 2024", "value": <integer>}},
    {{"period": "Q4 2024", "value": <integer>}},
    {{"period": "Q1 2025", "value": <integer>}},
    {{"period": "Q2 2025", "value": <integer — projected>}}
  ],
  "content_mix": [
    {{"type": "<content type>", "percentage": <integer 0-100>}}
  ],
  "vs_brand_scorecard": [
    {{"dimension": "Content Quality",      "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Posting Frequency",    "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Audience Engagement",  "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Brand Consistency",    "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Visual Identity",      "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "SEO & Web Presence",   "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Community Building",   "competitor": <1-10>, "brand": <1-10>}},
    {{"dimension": "Innovation / Trends",  "competitor": <1-10>, "brand": <1-10>}}
  ],
  "what_they_do_better": [
    {{
      "area": "<specific area>",
      "detail": "<detailed explanation with specifics>",
      "impact": "<business/marketing impact>",
      "how_to_respond": "<specific tactical response for our brand>"
    }}
  ],
  "their_strategy": {{
    "core_message": "<their brand's central message/positioning>",
    "content_pillars": ["<pillar 1>", "<pillar 2>", "<pillar 3>"],
    "posting_cadence": "<e.g. Daily on Instagram, 3x/week on LinkedIn>",
    "cta_strategy": "<how they drive action>",
    "audience_focus": "<who they primarily target>"
  }},
  "opportunities": [
    {{
      "opportunity": "<specific opportunity for our brand vs this competitor>",
      "rationale": "<why this is an opening>",
      "action": "<concrete action to take>",
      "difficulty": "easy|medium|hard",
      "time_to_impact": "<e.g. 2-4 weeks>"
    }}
  ],
  "threat_assessment": {{
    "overall_threat": "high|medium|low",
    "threat_rationale": "<why this threat level>",
    "areas_of_direct_competition": ["<area 1>", "<area 2>"],
    "areas_of_no_overlap": ["<area 1>", "<area 2>"]
  }}
}}

IMPORTANT:
- For platform_metrics, only include platforms where we have data OR reasonable estimates
- For revenue_trajectory, label Q2 2025 as projected
- Be realistic with follower estimates based on the industry and company size
- The vs_brand_scorecard brand scores should reflect the brand core honestly
- Make what_they_do_better specific and actionable, at least 3 items
- Make opportunities actionable with concrete next steps, at least 3 items
- Label all estimates clearly with is_estimated: true"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        result = _parse_json_response(response.content[0].text)
        # Inject real metrics where available
        for rm in real_metrics:
            for pm in result.get("platform_metrics", []):
                if pm.get("platform") == rm["platform"] and rm["followers"]:
                    pm["followers"] = rm["followers"]
                    pm["is_estimated"] = False
                    if rm["avg_likes"]:
                        pm["avg_likes"] = rm["avg_likes"]
                    if rm["avg_comments"]:
                        pm["avg_comments"] = rm["avg_comments"]
        return result
    except Exception:
        return {
            "company_profile": {"description": "", "industry": "", "estimated_size": "", "founded_estimate": "", "hq_location": "", "funding_stage": "unknown", "revenue_range": "Unknown", "business_model": ""},
            "platform_metrics": [],
            "growth_trajectory": [],
            "revenue_trajectory": [],
            "content_mix": [],
            "vs_brand_scorecard": [],
            "what_they_do_better": [],
            "their_strategy": {"core_message": "", "content_pillars": [], "posting_cadence": "", "cta_strategy": "", "audience_focus": ""},
            "opportunities": [],
            "threat_assessment": {"overall_threat": "medium", "threat_rationale": "", "areas_of_direct_competition": [], "areas_of_no_overlap": []},
        }


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
"""
Web-enriched intelligence functions — appended to intelligence_service.py
"""

# ---------------------------------------------------------------------------
# Web-enriched Competitor Intelligence (Exa + Tavily)
# ---------------------------------------------------------------------------

async def refresh_competitor_intelligence_web(
    project_id: str,
    competitors: list[dict],
) -> dict:
    """
    Augments competitor snapshots with live web data via Exa + Tavily.
    Merges with existing Apify social snapshots in Firestore.
    """
    from backend.services import firebase_service
    from backend.services.integrations import exa_client, tavily_client

    results = []

    for competitor in competitors[:5]:
        name = competitor.get("name", "Unknown")
        domain = competitor.get("website") or competitor.get("url") or ""

        web_data: dict = {"name": name, "web": {}}

        try:
            company_results = await exa_client.search_companies(
                f"{name} brand website official",
                num_results=3,
                project_id=project_id,
            )
            if company_results:
                top = company_results[0]
                web_data["web"]["company_url"] = top.get("url", "")
                web_data["web"]["company_summary"] = (
                    top.get("summary") or
                    (top.get("highlights", [""])[0] if top.get("highlights") else "")
                )
                if not domain and top.get("url"):
                    domain = top["url"]
        except Exception as exc:
            logger.warning("Exa company search failed for %s: %s", name, exc)

        try:
            news_resp = await tavily_client.search_news(
                query=f"{name} brand news announcement",
                days=30,
                max_results=5,
                project_id=project_id,
            )
            news_items = news_resp.get("results", [])
            web_data["web"]["recent_news"] = [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", "")[:300],
                    "date": r.get("published_date", ""),
                }
                for r in news_items[:5]
            ]
            web_data["web"]["news_summary"] = news_resp.get("answer", "")
        except Exception as exc:
            logger.warning("Tavily news search failed for %s: %s", name, exc)

        if domain:
            try:
                url_for_similar = domain if domain.startswith("http") else f"https://{domain}"
                similar = await exa_client.find_similar(
                    url=url_for_similar,
                    num_results=5,
                    project_id=project_id,
                )
                web_data["web"]["similar_companies"] = [
                    {"title": r.get("title", ""), "url": r.get("url", "")}
                    for r in similar[:5]
                ]
            except Exception as exc:
                logger.warning("Exa findSimilar failed for %s: %s", name, exc)

        if web_data["web"]:
            analysis = await _analyse_competitor_web(name, web_data["web"])
            web_data["web_analysis"] = analysis
            try:
                existing = firebase_service.get_competitor_snapshot(project_id, name)
                if existing:
                    merged = {**existing, "web": web_data["web"], "web_analysis": analysis}
                    firebase_service.save_competitor_snapshot(project_id, merged)
                else:
                    firebase_service.save_competitor_snapshot(project_id, web_data)
            except Exception:
                pass

        results.append({"name": name, "web_enriched": bool(web_data["web"])})

    return {"web_refreshed": results}


async def stream_refresh_competitor_intelligence(
    project_id: str,
    competitors: list[dict],
):
    """
    Streaming version of competitor intelligence refresh.
    Yields SSE-style event dicts with live progress updates.
    Uses Apify (Instagram, Facebook, TikTok, LinkedIn, YouTube),
    Firecrawl (website), Exa+Tavily (web intelligence), then Claude analysis.
    """
    import asyncio as _asyncio
    from backend.services import firebase_service
    from backend.services.ingestion.apify_client import (
        scrape_instagram, scrape_facebook, scrape_tiktok,
        scrape_linkedin, scrape_youtube, scrape_threads,
    )
    from backend.config import settings as _settings

    def _evt(message: str, icon: str = "activity", detail: str = "", competitor: str = "") -> dict:
        return {"type": "step", "message": message, "icon": icon, "detail": detail, "competitor": competitor}

    if not _settings.APIFY_API_KEY:
        yield _evt("Apify API key not configured — skipping social scraping", "warn")

    results = []
    all_scraped_for_batch: list[dict] = []
    total = min(len(competitors), 5)

    for idx, competitor in enumerate(competitors[:5]):
        name = competitor.get("name", "Unknown")
        website = competitor.get("website", "")
        scraped: dict = {
            "name": name,
            "platforms": {},
            "website": website,
            "logo_url": _logo_url(website),
        }

        yield _evt(f"[{idx+1}/{total}] Starting analysis of {name}", "zap", competitor=name)

        # Instagram
        if competitor.get("instagram") and _settings.APIFY_API_KEY:
            handle = competitor["instagram"].lstrip("@")
            yield _evt(f"Scraping @{handle} on Instagram…", "instagram", f"Fetching last 15 posts", name)
            try:
                data = await scrape_instagram(competitor["instagram"], _settings.APIFY_API_KEY, max_posts=15)
                profile = data.get("profile", {})
                followers = profile.get("followers", 0)
                post_count = len(data.get("posts", []))
                scraped["platforms"]["instagram"] = {
                    "posts": data.get("posts", [])[:10],
                    "profile": profile,
                    "followers": followers,
                    "raw_captions": (data.get("raw_captions") or "")[:3000],
                }
                yield _evt(
                    f"Instagram: {followers:,} followers · {post_count} posts scraped",
                    "check", f"@{handle}", name,
                )
            except Exception as exc:
                yield _evt(f"Instagram scrape failed for {name}", "warn", str(exc)[:80], name)

        # Facebook
        if competitor.get("facebook") and _settings.APIFY_API_KEY:
            yield _evt(f"Reading {name}'s Facebook page…", "facebook", competitor["facebook"][:60], name)
            try:
                data = await scrape_facebook(competitor["facebook"], _settings.APIFY_API_KEY)
                page_likes = data.get("likes", 0)
                scraped["platforms"]["facebook"] = {
                    "posts": data.get("posts", [])[:10],
                    "name": data.get("name", ""),
                    "followers": page_likes,
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
                yield _evt(f"Facebook: {page_likes:,} page likes", "check", data.get("name",""), name)
            except Exception as exc:
                yield _evt(f"Facebook scrape failed for {name}", "warn", str(exc)[:80], name)

        # TikTok
        if competitor.get("tiktok") and _settings.APIFY_API_KEY:
            yield _evt(f"Scanning {name}'s TikTok…", "video", competitor["tiktok"][:60], name)
            try:
                data = await scrape_tiktok(competitor["tiktok"], _settings.APIFY_API_KEY, max_videos=10)
                followers = data.get("followers", 0)
                scraped["platforms"]["tiktok"] = {
                    "videos": data.get("videos", [])[:10],
                    "followers": followers,
                    "top_hashtags": data.get("top_hashtags", []),
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
                yield _evt(f"TikTok: {followers:,} followers · {len(data.get('videos',[]))} videos", "check", "", name)
            except Exception as exc:
                yield _evt(f"TikTok scrape failed for {name}", "warn", str(exc)[:80], name)

        # LinkedIn
        if competitor.get("linkedin") and _settings.APIFY_API_KEY:
            yield _evt(f"Reading {name}'s LinkedIn company page…", "linkedin", "", name)
            try:
                data = await scrape_linkedin(competitor["linkedin"], _settings.APIFY_API_KEY)
                followers = data.get("followers", 0)
                employees = data.get("employees", 0)
                scraped["platforms"]["linkedin"] = {
                    "posts": data.get("posts", [])[:10],
                    "followers": followers,
                    "tagline": data.get("tagline", ""),
                    "industry": data.get("industry", ""),
                    "employees": employees,
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
                yield _evt(
                    f"LinkedIn: {followers:,} followers · {employees:,} employees",
                    "check", data.get("tagline","")[:60], name,
                )
            except Exception as exc:
                yield _evt(f"LinkedIn scrape failed for {name}", "warn", str(exc)[:80], name)

        # YouTube
        if competitor.get("youtube") and _settings.APIFY_API_KEY:
            yield _evt(f"Scanning {name}'s YouTube channel…", "youtube", "", name)
            try:
                data = await scrape_youtube(competitor["youtube"], _settings.APIFY_API_KEY, max_videos=10)
                subs = data.get("subscribers", 0)
                scraped["platforms"]["youtube"] = {
                    "videos": data.get("videos", [])[:10],
                    "channel_name": data.get("channel_name", ""),
                    "subscribers": subs,
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
                yield _evt(f"YouTube: {subs:,} subscribers · {len(data.get('videos',[]))} videos", "check", data.get("channel_name",""), name)
            except Exception as exc:
                yield _evt(f"YouTube scrape failed for {name}", "warn", str(exc)[:80], name)

        # Threads
        if competitor.get("threads") and _settings.APIFY_API_KEY:
            yield _evt(f"Scanning {name}'s Threads…", "activity", competitor["threads"][:60], name)
            try:
                data = await scrape_threads(competitor["threads"], _settings.APIFY_API_KEY)
                followers = data.get("followers", 0)
                scraped["platforms"]["threads"] = {
                    "posts": data.get("posts", [])[:10],
                    "followers": followers,
                    "raw_text": (data.get("raw_text") or "")[:3000],
                }
                yield _evt(f"Threads: {followers:,} followers · {len(data.get('posts',[]))} posts", "check", "", name)
            except Exception as exc:
                yield _evt(f"Threads scrape failed for {name}", "warn", str(exc)[:80], name)

        # Website — Firecrawl
        if competitor.get("website") and _settings.FIRECRAWL_API_KEY:
            url = competitor["website"]
            if not url.startswith("http"):
                url = f"https://{url}"
            yield _evt(f"Reading {url}…", "read", "Extracting website content", name)
            try:
                from backend.services.ingestion.firecrawl_client import scrape_url
                scraped_web = await scrape_url(url, _settings.FIRECRAWL_API_KEY)
                content = scraped_web.get("markdown") or scraped_web.get("content") or ""
                if content:
                    scraped["platforms"]["website"] = {
                        "raw_text": content[:3000],
                        "url": url,
                    }
                    yield _evt(f"Website content extracted", "check", f"{len(content)} chars from {url}", name)
            except Exception as exc:
                yield _evt(f"Could not read {url}", "warn", str(exc)[:60], name)

        # Web enrichment — Exa + Tavily
        from backend.config import settings as _s
        if _s.EXA_API_KEY or _s.TAVILY_API_KEY:
            from backend.services.integrations import exa_client, tavily_client
            yield _evt(f"Web intelligence search for {name}…", "globe", "Exa + Tavily", name)
            try:
                web_tasks = []
                if _s.TAVILY_API_KEY:
                    web_tasks.append(tavily_client.search_news(
                        query=f"{name} brand news announcement product launch",
                        days=60, max_results=4, project_id=project_id,
                    ))
                if _s.EXA_API_KEY:
                    web_tasks.append(exa_client.search_companies(
                        f"{name} company brand", num_results=3, project_id=project_id,
                    ))
                web_results = await _asyncio.gather(*web_tasks, return_exceptions=True)
                news_count = 0
                for wr in web_results:
                    if isinstance(wr, Exception):
                        continue
                    if isinstance(wr, dict):  # Tavily news result
                        news = wr.get("results", [])
                        news_count += len(news)
                        if news:
                            scraped["web"] = scraped.get("web", {})
                            scraped["web"]["recent_news"] = [
                                {"title": r.get("title",""), "snippet": r.get("content","")[:200]}
                                for r in news[:4]
                            ]
                yield _evt(f"Found {news_count} recent news items for {name}", "check", "", name)
            except Exception as exc:
                yield _evt(f"Web enrichment skipped for {name}", "warn", str(exc)[:60], name)

        # Collect for batch analysis — don't call Claude yet
        if scraped["platforms"]:
            all_scraped_for_batch.append(scraped)

        results.append({
            "name": name,
            "platforms_scraped": list(scraped["platforms"].keys()),
        })

    # Batch Claude analysis — ONE call for all competitors instead of N calls
    if all_scraped_for_batch:
        yield _evt(f"Analysing {len(all_scraped_for_batch)} competitor(s) with Claude AI…", "brain", "Single batch call")
        try:
            analyses = await _analyse_competitors_batch(all_scraped_for_batch)
            for scraped in all_scraped_for_batch:
                name = scraped["name"]
                scraped["analysis"] = analyses.get(name, {"tone": "Unknown", "key_themes": [], "content_gaps": []})
                themes_found = scraped["analysis"].get("key_themes", [])
                yield _evt(
                    f"Analysis complete for {name}",
                    "check",
                    f"Themes: {', '.join(themes_found[:3])}" if themes_found else "Strategy extracted",
                    name,
                )
                try:
                    firebase_service.save_competitor_snapshot(project_id, scraped)
                except Exception as exc:
                    yield _evt(f"Save failed for {name}", "warn", str(exc)[:60], name)
        except Exception as exc:
            yield _evt("Batch analysis failed", "warn", str(exc)[:80])

    # Web analysis in background for all competitors
    if (_settings.EXA_API_KEY or _settings.TAVILY_API_KEY) and results:
        yield _evt("Running deep web analysis in background…", "globe", "Exa + Tavily enrichment")
        try:
            import asyncio as _a
            _a.create_task(refresh_competitor_intelligence_web(project_id, competitors))
        except Exception:
            pass

    yield _evt(f"All done — {len(results)} competitor(s) analysed", "done")
    yield {"type": "result", "refreshed": results}


async def _analyse_competitor_web(name: str, web_data: dict) -> dict:
    client = get_client()

    news_section = ""
    if web_data.get("recent_news"):
        headlines = "\n".join(
            f"- {n['title']} ({n['date'][:10]})" for n in web_data["recent_news"][:5]
        )
        news_section = f"\nRECENT NEWS:\n{headlines}"

    summary = web_data.get("company_summary") or web_data.get("news_summary") or ""

    prompt = f"""Analyse this competitor based on web intelligence.

COMPETITOR: {name}
WEB SUMMARY: {summary[:500]}
{news_section}

Return ONLY valid JSON:
{{
  "recent_news_summary": "<1-2 sentence summary>",
  "market_position": "<current positioning>",
  "momentum": "growing",
  "recent_moves": [],
  "opportunity": "<key opportunity for our brand>"
}}"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {"recent_news_summary": "", "market_position": "", "momentum": "stable", "recent_moves": [], "opportunity": ""}


# ---------------------------------------------------------------------------
# Live-enriched Hashtag Research
# ---------------------------------------------------------------------------

async def research_hashtags_enriched(
    topic: str,
    platform: str,
    content: str,
    brand_core: dict,
    project_id: Optional[str] = None,
) -> dict:
    """research_hashtags() with live Tavily + Exa trend data injected."""
    import asyncio as _asyncio
    from backend.services.integrations import tavily_client as _tavily, exa_client as _exa
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    live_context = ""
    try:
        async def _tv():
            r = await _tavily.search_basic(
                query=f"trending {topic} hashtags {platform} 2025",
                max_results=3, include_answer=True, project_id=project_id,
            )
            return r.get("answer", "")

        async def _ex():
            rs = await _exa.search(
                query=f"best hashtags {topic} {platform} strategy",
                num_results=3, include_highlights=True, project_id=project_id,
            )
            return " ".join(r.get("highlights", [""])[0] for r in rs[:3] if r.get("highlights"))

        tv_ans, ex_ans = await _asyncio.gather(_tv(), _ex(), return_exceptions=True)
        parts = [x for x in [tv_ans, ex_ans] if isinstance(x, str) and x]
        if parts:
            live_context = "\nLIVE TREND DATA:\n" + "\n".join(parts[:2])
    except Exception:
        pass

    content_section = f"\nCONTENT:\n{content[:500]}" if content else ""

    prompt = f"""You are a social media hashtag strategist.
BRAND: {brand_context}
PLATFORM: {platform}
TOPIC: {topic}{content_section}{live_context}

Return ONLY valid JSON:
{{
  "tiers": {{
    "mega":   [{{"tag": "#tag", "approx_posts": "10M+"}}],
    "large":  [{{"tag": "#tag", "approx_posts": "800k"}}],
    "medium": [{{"tag": "#tag", "approx_posts": "120k"}}],
    "niche":  [{{"tag": "#tag", "approx_posts": "8k"}}]
  }},
  "strategy": "<one sentence>",
  "recommended_mix": "<e.g. 3 mega + 6 large + 8 medium + 5 niche>",
  "trending_now": ["<currently trending tag>"]
}}"""

    response = await client.messages.create(
        model=settings.LLM_CHAT_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return _parse_json_response(response.content[0].text)
    except Exception:
        return {"tiers": {"mega": [], "large": [], "medium": [], "niche": []}, "strategy": "", "recommended_mix": "", "trending_now": []}


# ---------------------------------------------------------------------------
# Influencer Discovery
# ---------------------------------------------------------------------------

async def discover_influencers(
    topic: str,
    platform: str,
    audience_size: str,
    brand_core: dict,
    location: Optional[str] = None,
    project_id: Optional[str] = None,
) -> dict:
    """Discover relevant influencers using Exa's 1B+ people index."""
    from backend.services.integrations import exa_client

    size_hint = {
        "micro": "micro-influencer 10k to 100k followers",
        "macro": "macro-influencer 100k to 1M followers",
        "mega": "mega influencer celebrity 1M+ followers",
    }.get(audience_size, "influencer")

    query = f"{topic} {platform} {size_hint} content creator"
    if location:
        query += f" {location}"

    try:
        raw_results = await exa_client.search_people(query=query, num_results=20, project_id=project_id)
    except Exception as exc:
        logger.error("Exa people search failed: %s", exc)
        return {"influencers": [], "total_found": 0, "error": str(exc)}

    if not raw_results:
        return {"influencers": [], "total_found": 0}

    top_urls = [r["url"] for r in raw_results[:10] if r.get("url")]
    bio_contents: dict[str, str] = {}
    if top_urls:
        try:
            contents = await exa_client.get_contents(top_urls, max_chars=400, project_id=project_id)
            for c in contents:
                if c.get("url") and c.get("text"):
                    bio_contents[c["url"]] = c["text"][:400]
        except Exception:
            pass

    enriched = []
    for r in raw_results[:10]:
        bio = bio_contents.get(r.get("url", ""), "")
        if not bio:
            bio = r.get("summary") or (r.get("highlights", [""])[0] if r.get("highlights") else "")
        enriched.append({
            "name": r.get("title", "")[:80],
            "url": r.get("url", ""),
            "bio": bio[:300],
            "score": r.get("score", 0.5),
        })

    scored = await _score_influencer_alignment(enriched, topic, brand_core)
    return {"influencers": scored, "total_found": len(raw_results), "query_used": query}


async def _score_influencer_alignment(candidates: list[dict], topic: str, brand_core: dict) -> list[dict]:
    client = get_client()
    brand_context = build_brand_core_context(brand_core)
    candidate_list = "\n".join(
        f"{i+1}. {c['name']} ({c['url']})\nBio: {c['bio']}"
        for i, c in enumerate(candidates)
    )

    prompt = f"""Score these influencer candidates for brand alignment.
BRAND CORE: {brand_context}
TOPIC: {topic}
CANDIDATES:
{candidate_list}

Return ONLY valid JSON:
{{"scored": [{{"index": 1, "relevance_score": 0.85, "brand_alignment": "<1 sentence>"}}]}}"""

    score_map: dict = {}
    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _parse_json_response(response.content[0].text)
        score_map = {s["index"]: s for s in data.get("scored", [])}
    except Exception:
        pass

    result = []
    for i, c in enumerate(candidates, 1):
        s = score_map.get(i, {})
        result.append({
            "name": c["name"], "url": c["url"], "bio": c["bio"],
            "relevance_score": s.get("relevance_score", round(c.get("score", 0.5), 2)),
            "brand_alignment": s.get("brand_alignment", ""),
        })
    result.sort(key=lambda x: x["relevance_score"], reverse=True)
    return result[:8]


# ---------------------------------------------------------------------------
# Competitor Auto-Discovery
# ---------------------------------------------------------------------------

async def discover_competitors(
    project_id: str,
    brand_core: dict,
    website_url: Optional[str] = None,
) -> dict:
    """
    Discover competitors by:
    1. Web-searching "{brand} competitors" via Tavily (mimics Google AI Overview)
    2. Exa findSimilar on the brand website
    3. Exa company search on brand themes
    4. Synthesising all sources with Claude into rich competitor profiles
    """
    import asyncio as _asyncio
    from backend.services.integrations import exa_client, tavily_client

    brand_name = brand_core.get("brandName") or brand_core.get("name") or "this brand"
    industry   = brand_core.get("industry") or ""
    themes     = brand_core.get("themes") or []
    existing   = set(brand_core.get("competitors") or [])

    raw_web_results: list[str] = []
    candidates: list[dict] = []

    # ── 1. Tavily: "{brand} competitors" direct web search ──────────────────
    async def _tavily_competitor_search():
        try:
            query = f"{brand_name} {industry} top competitors alternatives"
            resp = await tavily_client.search_advanced(
                query=query,
                max_results=8,
                include_answer=True,
                project_id=project_id,
            )
            answer = resp.get("answer", "")
            snippets = [
                f"{r.get('title', '')}: {r.get('content', '')[:400]}"
                for r in (resp.get("results") or [])[:6]
            ]
            return answer, snippets
        except Exception as exc:
            logger.warning("Tavily competitor search failed: %s", exc)
            return "", []

    # ── 2. Exa findSimilar on brand website ─────────────────────────────────
    async def _exa_similar():
        if not website_url:
            return []
        try:
            from urllib.parse import urlparse
            domain = urlparse(website_url).netloc
            similar = await exa_client.find_similar(
                url=website_url, num_results=8,
                exclude_domains=[domain], project_id=project_id,
            )
            return [
                {
                    "name": r.get("title", "").split("|")[0].strip()[:60],
                    "url": r.get("url", ""),
                    "snippet": r.get("summary") or (r.get("highlights") or [""])[0],
                }
                for r in similar
                if r.get("title")
            ]
        except Exception as exc:
            logger.warning("Exa findSimilar failed: %s", exc)
            return []

    # ── 3. Exa company search on brand themes ────────────────────────────────
    async def _exa_company_search():
        if not themes:
            return []
        try:
            query = f"{' '.join(themes[:2])} {industry} company startup"
            results = await exa_client.search_companies(query, num_results=8, project_id=project_id)
            return [
                {
                    "name": r.get("title", "").split("|")[0].strip()[:60],
                    "url": r.get("url", ""),
                    "snippet": r.get("summary") or "",
                }
                for r in results
                if r.get("title")
            ]
        except Exception as exc:
            logger.warning("Exa company search failed: %s", exc)
            return []

    # Run all three in parallel
    (tavily_answer, tavily_snippets), exa_similar_results, exa_company_results = (
        await _asyncio.gather(
            _tavily_competitor_search(),
            _exa_similar(),
            _exa_company_search(),
        )
    )

    raw_web_results = [tavily_answer] + tavily_snippets if tavily_answer else tavily_snippets
    candidates = exa_similar_results + exa_company_results

    # ── 4. Claude: synthesise everything into rich profiles ──────────────────
    client = get_client()
    brand_context = build_brand_core_context(brand_core)

    web_context = "\n\n".join(filter(None, raw_web_results[:8]))
    candidate_list = "\n".join(
        f"- {c['name']} ({c['url']}): {c['snippet'][:200]}"
        for c in candidates[:10]
        if c.get("name") and c["name"] not in existing
    )

    prompt = f"""You are a competitive intelligence analyst. Identify the top 6 genuine competitors for this brand.

OUR BRAND: {brand_name}
BRAND CORE: {brand_context}

WEB SEARCH RESULTS (from "{brand_name} competitors" search):
{web_context[:3000] or "No web results available"}

ADDITIONAL COMPANY CANDIDATES:
{candidate_list[:2000] or "None found"}

Extract the 6 most relevant competitors. For each, extract or infer as much information as possible from the available data.

Return ONLY valid JSON:
{{
  "competitors": [
    {{
      "name": "<company name>",
      "url": "<website URL>",
      "description": "<1-2 sentence description of what they do>",
      "what_they_do": "<their core product/service in plain language>",
      "key_advantage": "<their main competitive advantage>",
      "location": "<city, country>",
      "founded": "<year or range e.g. 2018-2020>",
      "employee_count": "<e.g. 11-50 or 200+>",
      "funding_stage": "<bootstrapped|pre-seed|seed|series-a|series-b|public|unknown>",
      "funding_amount": "<e.g. $300K or $2.5M or unknown>",
      "industry": "<industry/sector>",
      "why_competitor": "<1 sentence: why they directly compete with us>",
      "relevance_score": <float 0.0-1.0>,
      "social_hints": {{
        "instagram": "<handle if known, else null>",
        "linkedin": "<company URL if known, else null>",
        "twitter": "<handle if known, else null>"
      }}
    }}
  ]
}}

IMPORTANT:
- Only include genuine competitors (same market, similar customers)
- Relevance score: 0.9+ means direct/primary competitor, 0.6-0.8 means significant, 0.4-0.6 means adjacent
- Extract real data from the web results — don't fabricate funding amounts you don't see in the sources
- Use "unknown" for fields you cannot determine
- Order by relevance_score descending"""

    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        result = _parse_json_response(response.content[0].text)
        competitors = result.get("competitors", [])
        # Filter already-tracked
        competitors = [c for c in competitors if c.get("name") and c["name"] not in existing]
        return {"competitors": competitors[:6]}
    except Exception as exc:
        logger.warning("Competitor discovery synthesis failed: %s", exc)
        # Fallback: return raw candidates
        return {
            "competitors": [
                {
                    "name": c["name"],
                    "url": c["url"],
                    "description": c.get("snippet", ""),
                    "why_competitor": "Similar company in the same space",
                    "relevance_score": 0.6,
                }
                for c in candidates[:6]
                if c.get("name") and c["name"] not in existing
            ]
        }


# ---------------------------------------------------------------------------
# Streaming Competitor Auto-Discovery
# ---------------------------------------------------------------------------

async def stream_discover_competitors(
    project_id: str,
    brand_core: dict,
    website_url: Optional[str] = None,
):
    """
    Streaming version of competitor discovery. Yields SSE-style event dicts.
    Uses Tavily, Exa findSimilar, Exa company search, Exa answer,
    and Firecrawl to scrape competitor websites for rich profiles.
    """
    import asyncio as _asyncio
    from backend.services.integrations import exa_client, tavily_client
    from backend.config import settings as _settings

    brand_name = brand_core.get("brandName") or brand_core.get("name") or "this brand"
    industry   = brand_core.get("industry") or ""
    themes     = brand_core.get("themes") or []
    existing   = set(brand_core.get("competitors") or [])

    def _evt(message: str, icon: str = "search", detail: str = "") -> dict:
        return {"type": "step", "message": message, "icon": icon, "detail": detail}

    raw_web_results: list[str] = []
    candidates: list[dict] = []

    # ── 1. Tavily: "{brand} competitors" ────────────────────────────────────
    yield _evt(f'Searching the web for "{brand_name} competitors"…', "search")
    try:
        resp = await tavily_client.search_advanced(
            query=f"{brand_name} {industry} top competitors alternatives similar companies",
            max_results=8,
            include_answer=True,
            project_id=project_id,
        )
        answer = resp.get("answer", "")
        results = resp.get("results") or []
        snippets = [f"{r.get('title','')}: {r.get('content','')[:400]}" for r in results[:6]]
        if answer:
            raw_web_results.append(answer)
        raw_web_results.extend(snippets)
        yield _evt(
            f"Found {len(results)} web sources",
            "check",
            answer[:120] if answer else f"{len(results)} articles indexed",
        )
    except Exception as exc:
        yield _evt("Web search unavailable — trying other sources", "warn", str(exc)[:80])

    # ── 2. Tavily: industry competitor landscape ─────────────────────────────
    if industry or themes:
        industry_q = industry or (themes[0] if themes else brand_name)
        yield _evt(f'Analysing "{industry_q}" competitive landscape…', "map")
        try:
            resp2 = await tavily_client.search_basic(
                query=f"best {industry_q} companies startups competitive analysis 2024 2025",
                max_results=6,
                include_answer=True,
                project_id=project_id,
            )
            answer2 = resp2.get("answer", "")
            results2 = resp2.get("results") or []
            snippets2 = [f"{r.get('title','')}: {r.get('content','')[:300]}" for r in results2[:5]]
            if answer2:
                raw_web_results.append(answer2)
            raw_web_results.extend(snippets2)
            yield _evt(f"Indexed {len(results2)} industry sources", "check", answer2[:100] if answer2 else "")
        except Exception as exc:
            yield _evt("Industry search skipped", "warn", str(exc)[:80])

    # ── 3. Exa: answer "{brand} top competitors" directly ───────────────────
    yield _evt(f'Deep-diving "{brand_name}" competitive position via Exa…', "brain")
    try:
        exa_answer = await exa_client.answer_question(
            query=f"Who are the top 6 competitors of {brand_name}? List their names, websites, locations, and what they do.",
            project_id=project_id,
        )
        answer_text = exa_answer.get("answer", "")
        if answer_text:
            raw_web_results.append(answer_text)
            yield _evt("Exa intelligence retrieved", "check", answer_text[:120])
    except Exception as exc:
        yield _evt("Exa answer unavailable", "warn", str(exc)[:80])

    # ── 4. Exa findSimilar on brand website ──────────────────────────────────
    if website_url:
        yield _evt(f"Finding similar companies to {website_url}…", "globe")
        try:
            from urllib.parse import urlparse
            domain = urlparse(website_url).netloc
            similar = await exa_client.find_similar(
                url=website_url, num_results=8,
                exclude_domains=[domain], project_id=project_id,
            )
            found = [
                {
                    "name": r.get("title","").split("|")[0].strip()[:60],
                    "url": r.get("url",""),
                    "snippet": r.get("summary") or (r.get("highlights") or [""])[0],
                }
                for r in similar if r.get("title")
            ]
            candidates.extend(found)
            yield _evt(f"Found {len(found)} similar companies", "check", ", ".join(c["name"] for c in found[:4]))
        except Exception as exc:
            yield _evt("findSimilar skipped", "warn", str(exc)[:80])

    # ── 5. Exa company search by themes ──────────────────────────────────────
    if themes or industry:
        q = f"{' '.join(themes[:2])} {industry} company startup brand".strip()
        yield _evt(f'Searching Exa company database for "{q[:50]}"…', "database")
        try:
            results = await exa_client.search_companies(q, num_results=8, project_id=project_id)
            found = [
                {
                    "name": r.get("title","").split("|")[0].strip()[:60],
                    "url": r.get("url",""),
                    "snippet": r.get("summary") or "",
                }
                for r in results if r.get("title")
            ]
            candidates.extend(found)
            yield _evt(f"Found {len(found)} companies in Exa database", "check", ", ".join(c["name"] for c in found[:4]))
        except Exception as exc:
            yield _evt("Exa company search skipped", "warn", str(exc)[:80])

    # ── 6. Firecrawl: scrape up to 8 candidate websites for deeper info ───────
    if _settings.FIRECRAWL_API_KEY and candidates:
        from backend.services.ingestion.firecrawl_client import scrape_url
        scraped_domains: set[str] = set()
        scrape_targets = []
        for c in candidates[:15]:
            if c.get("url"):
                try:
                    from urllib.parse import urlparse as _up
                    d = _up(c["url"]).netloc
                    if d and d not in scraped_domains:
                        scraped_domains.add(d)
                        scrape_targets.append(c)
                        if len(scrape_targets) >= 8:
                            break
                except Exception:
                    pass

        for target in scrape_targets:
            tgt_url = target["url"]
            tgt_name = target["name"]
            yield _evt(f"Reading {tgt_name}'s website…", "read", tgt_url)
            try:
                scraped = await scrape_url(tgt_url, _settings.FIRECRAWL_API_KEY)
                content = scraped.get("markdown") or scraped.get("content") or ""
                if content:
                    # Extract social links directly from the scraped page
                    site_socials = extract_social_links(content)
                    social_note = ""
                    if site_socials:
                        social_note = " | Socials: " + ", ".join(f"{p}: {u}" for p, u in site_socials.items())
                        # Enrich the candidate with discovered socials for Claude context
                        target["socials"] = site_socials
                    raw_web_results.append(
                        f"WEBSITE CONTENT for {tgt_name} ({tgt_url}):\n{content[:2000]}{social_note}"
                    )
                    yield _evt(f"Scraped {tgt_name}", "check", f"{len(content)} chars · {len(site_socials)} social links found")
            except Exception as exc:
                yield _evt(f"Could not read {tgt_name}'s website", "warn", str(exc)[:60])

    # ── 7. Claude synthesises everything into up to 12 competitors ───────────
    yield _evt("Synthesising all intelligence with Claude AI…", "brain")

    client = get_client()
    brand_context = build_brand_core_context(brand_core)
    web_context = "\n\n".join(filter(None, raw_web_results[:15]))
    candidate_list = "\n".join(
        f"- {c['name']} ({c['url']}): {c.get('snippet','')[:200]}"
        + (f" | Socials: {c['socials']}" if c.get('socials') else "")
        for c in candidates[:15]
        if c.get("name") and c["name"] not in existing
    )

    prompt = f"""You are a competitive intelligence analyst. Identify the top 12 genuine competitors for this brand from the research below.

OUR BRAND: {brand_name}
BRAND CORE: {brand_context}

WEB RESEARCH:
{web_context[:6000] or "No web results"}

ADDITIONAL CANDIDATES (with any social links found on their websites):
{candidate_list[:3000] or "None"}

Extract the 12 most relevant competitors. For each:
- Use ONLY real data from the research — do not fabricate URLs, handles, or stats
- If a social link was found on their website, include it in social_hints
- Include as many social platforms as you can find evidence for

Return ONLY valid JSON:
{{
  "competitors": [
    {{
      "name": "<company name>",
      "url": "<website URL — from research>",
      "description": "<1-2 sentence description>",
      "what_they_do": "<their core product/service>",
      "key_advantage": "<their main competitive advantage>",
      "location": "<city, country — from research or unknown>",
      "founded": "<year — from research or unknown>",
      "employee_count": "<e.g. 11-50 — from research or unknown>",
      "funding_stage": "<bootstrapped|pre-seed|seed|series-a|series-b|public|unknown>",
      "funding_amount": "<e.g. $300K — from research only, else unknown>",
      "industry": "<industry>",
      "why_competitor": "<1 sentence: why they directly compete>",
      "relevance_score": <0.0-1.0>,
      "social_hints": {{
        "instagram": "<full URL or @handle if found, else null>",
        "facebook": "<full URL if found, else null>",
        "tiktok": "<full URL or @handle if found, else null>",
        "linkedin": "<full LinkedIn company URL if found, else null>",
        "youtube": "<full YouTube URL if found, else null>",
        "twitter": "<@handle if found, else null>"
      }}
    }}
  ]
}}

Order by relevance_score descending. Only include genuine competitors — no investors, partners, or suppliers."""

    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=1800,  # competitor discovery JSON (up to 10 competitors), rarely > 1500 tokens
            messages=[{"role": "user", "content": prompt}],
        )
        result = _parse_json_response(response.content[0].text)
        competitors = [c for c in result.get("competitors", []) if c.get("name") and c["name"] not in existing]
        yield _evt(f"Analysis complete — {len(competitors)} competitors identified", "done")
        yield {"type": "result", "competitors": competitors[:12]}
    except Exception as exc:
        yield _evt("Synthesis failed — returning raw candidates", "warn", str(exc)[:80])
        fallback = [
            {
                "name": c["name"], "url": c["url"],
                "description": c.get("snippet", ""),
                "why_competitor": "Similar company in the same space",
                "relevance_score": 0.6,
            }
            for c in candidates[:12] if c.get("name") and c["name"] not in existing
        ]
        yield _evt(f"Returning {len(fallback)} candidates", "done")
        yield {"type": "result", "competitors": fallback}


# ---------------------------------------------------------------------------
# Social link extraction helpers
# ---------------------------------------------------------------------------

_SOCIAL_LINK_PATTERNS = {
    "instagram": re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9._]+)/?', re.IGNORECASE),
    "facebook":  re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/((?!share|sharer|login|signup|home|intent|p/|photo|video|hashtag|status|compose|settings)[A-Za-z0-9._/-]+)/?', re.IGNORECASE),
    "tiktok":    re.compile(r'(?:https?://)?(?:www\.)?tiktok\.com/@([A-Za-z0-9._]+)/?', re.IGNORECASE),
    "linkedin":  re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/company/([A-Za-z0-9._-]+)/?', re.IGNORECASE),
    "youtube":   re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/(@[A-Za-z0-9._-]+|channel/[A-Za-z0-9_-]+|c/[A-Za-z0-9._-]+)/?', re.IGNORECASE),
    "twitter":   re.compile(r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/([A-Za-z0-9_]{1,15})(?:[/?]|$)', re.IGNORECASE),
}

_SOCIAL_FALSE_POSITIVES = {
    "web", "search", "explore", "hashtag", "status", "intent", "share", "sharer",
    "login", "signup", "home", "about", "help", "compose", "settings", "i",
    "in", "jobs", "pulse", "feed", "me", "groups", "events", "pages",
}


def extract_social_links(content: str) -> dict:
    """
    Extract social media profile URLs from scraped website content.
    Returns a dict with platform -> full URL for each found platform.
    """
    links: dict[str, str] = {}
    for platform, pattern in _SOCIAL_LINK_PATTERNS.items():
        match = pattern.search(content)
        if not match:
            continue
        handle_or_path = match.group(1).lstrip("@").strip("/").split("/")[0].lower()
        if handle_or_path in _SOCIAL_FALSE_POSITIVES or len(handle_or_path) < 2:
            continue
        full = match.group(0).strip()
        if not full.startswith("http"):
            full = "https://" + full
        links[platform] = full
    return links


def _instagram_hint_to_url(hint: Optional[str]) -> Optional[str]:
    """Convert an @handle or bare handle from discovery to a full URL."""
    if not hint:
        return None
    hint = hint.strip()
    if "instagram.com" in hint:
        return hint
    handle = hint.lstrip("@")
    return f"https://instagram.com/{handle}" if handle else None


# ---------------------------------------------------------------------------
# Auto-add a discovered competitor (scrape social links + full refresh)
# ---------------------------------------------------------------------------

async def stream_add_discovered_competitor(
    project_id: str,
    competitor: dict,
    brand_core: dict,
):
    """
    Add a single discovered competitor automatically:
    1. Scrape their website for social media links
    2. Merge with any social_hints from discovery
    3. Run the full intelligence refresh stream
    """
    from backend.config import settings as _settings

    name = competitor.get("name") or "Unknown"
    url  = competitor.get("url") or ""
    hints = competitor.get("social_hints") or {}

    def _evt(message: str, icon: str = "activity", detail: str = "") -> dict:
        return {"type": "step", "message": message, "icon": icon, "detail": detail, "competitor": name}

    # ── Step 1: scrape website for social links ──────────────────────────────
    scraped_social: dict = {}
    if url and _settings.FIRECRAWL_API_KEY:
        yield _evt(f"Scraping {name}'s website for social media links…", "globe", url)
        try:
            from backend.services.ingestion.firecrawl_client import scrape_url
            scraped = await scrape_url(url, _settings.FIRECRAWL_API_KEY)
            content = scraped.get("markdown") or scraped.get("content") or ""
            if content:
                scraped_social = extract_social_links(content)
                found_platforms = list(scraped_social.keys())
                yield _evt(
                    f"Found {len(found_platforms)} social profiles on website" if found_platforms else "No social links on website",
                    "check",
                    ", ".join(found_platforms) if found_platforms else "",
                )
        except Exception as exc:
            yield _evt(f"Website scrape skipped", "warn", str(exc)[:80])

    # ── Step 2: merge scraped + discovery hints ──────────────────────────────
    merged_competitor = {
        "name":      name,
        "website":   url or None,
        "instagram": scraped_social.get("instagram") or _instagram_hint_to_url(hints.get("instagram")),
        "facebook":  scraped_social.get("facebook")  or hints.get("facebook") or None,
        "tiktok":    scraped_social.get("tiktok")    or hints.get("tiktok") or None,
        "linkedin":  scraped_social.get("linkedin")  or hints.get("linkedin") or None,
        "youtube":   scraped_social.get("youtube")   or hints.get("youtube") or None,
    }

    platforms_found = [p for p in ["instagram", "facebook", "tiktok", "linkedin", "youtube"] if merged_competitor.get(p)]
    yield _evt(
        f"Starting full analysis — {len(platforms_found)} platforms to scrape" if platforms_found else "Starting analysis (website only)",
        "zap",
        ", ".join(platforms_found),
    )

    # ── Step 3: run full intelligence refresh ────────────────────────────────
    async for event in stream_refresh_competitor_intelligence(project_id, [merged_competitor]):
        yield event
