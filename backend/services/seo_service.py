"""
SEO & content gap analysis service.

Uses Exa to find top-performing competitor content, then Claude to
identify topics the brand should be covering. Returns a prioritised
content topic list suitable for a content calendar or campaign brief.
"""

import logging
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)


async def analyse_content_gaps(
    project_id: str,
    brand_core: dict,
    competitors: list[str],
    topic: Optional[str] = None,
) -> dict:
    """
    Find content topics competitors rank for that the brand isn't covering.

    competitors: list of competitor brand names or domains
    topic: optional focus topic (e.g. "sustainability", "product launch")

    Returns:
    {
      "gaps": [{ topic, why, content_angle, priority }],
      "competitor_themes": { "brand_name": [themes] },
      "quick_wins": [topic_string],
      "summary": "..."
    }
    """
    from backend.services.integrations import exa_client, tavily_client
    from backend.services.llm_service import get_client, build_brand_core_context

    if not competitors:
        return {"gaps": [], "quick_wins": [], "summary": "No competitors provided."}

    brand_context = build_brand_core_context(brand_core)
    competitor_content: dict[str, str] = {}

    # 1. Fetch top content for each competitor
    for comp in competitors[:4]:
        search_query = f"{comp} blog content marketing {topic or ''}"
        try:
            results = await exa_client.search(
                query=search_query,
                num_results=5,
                include_highlights=True,
                project_id=project_id,
            )
            snippets = []
            for r in results[:5]:
                title = r.get("title", "")
                highlights = r.get("highlights", [])
                snippet = highlights[0] if highlights else r.get("summary", "")
                if title:
                    snippets.append(f"- {title}: {snippet[:200]}")
            competitor_content[comp] = "\n".join(snippets)
        except Exception as exc:
            logger.warning("Content gap search failed for %s: %s", comp, exc)

    # 2. Also search for industry trends
    industry_trends = ""
    if topic or brand_core.get("themes"):
        trend_topic = topic or (brand_core.get("themes") or [""])[0]
        try:
            resp = await tavily_client.search_advanced(
                query=f"{trend_topic} content marketing trends 2025",
                max_results=5,
                include_answer=True,
                project_id=project_id,
            )
            industry_trends = resp.get("answer", "")
        except Exception:
            pass

    # 3. Claude analysis
    comp_sections = "\n\n".join(
        f"COMPETITOR: {name}\nTOP CONTENT:\n{content}"
        for name, content in competitor_content.items()
        if content
    )

    trend_section = f"\nINDUSTRY TRENDS:\n{industry_trends}" if industry_trends else ""

    if not comp_sections:
        return {"gaps": [], "quick_wins": [], "summary": "Could not fetch competitor content."}

    client = get_client()
    prompt = f"""You are a content strategist. Analyse competitor content and identify gaps for this brand.

BRAND CORE:
{brand_context}

COMPETITOR CONTENT:
{comp_sections[:4000]}
{trend_section}

Identify content topics the competitors are covering that this brand should also create content about.
Focus on topics that align with the brand's voice and audience.

Return ONLY valid JSON:
{{
  "gaps": [
    {{
      "topic": "<content topic>",
      "why": "<why this matters for the brand>",
      "content_angle": "<unique angle the brand can take>",
      "priority": "high" | "medium" | "low"
    }}
  ],
  "competitor_themes": {{
    "<competitor_name>": ["<theme1>", "<theme2>"]
  }},
  "quick_wins": ["<topic that can be executed immediately>"],
  "summary": "<2-3 sentence strategic summary>"
}}

Return up to 8 gaps, ordered by priority."""

    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        return _parse_json_response(response.content[0].text)
    except Exception as exc:
        logger.error("Content gap analysis failed: %s", exc)
        return {"gaps": [], "quick_wins": [], "summary": f"Analysis failed: {exc}"}


async def suggest_content_topics(
    project_id: str,
    brand_core: dict,
    gaps: list[dict],
    num_topics: int = 10,
) -> dict:
    """
    Generate a prioritised content topic list from gap analysis results.
    Returns topics ready for a content calendar.
    """
    from backend.services.llm_service import get_client, build_brand_core_context

    if not gaps:
        return {"topics": [], "calendar_brief": ""}

    client = get_client()
    brand_context = build_brand_core_context(brand_core)
    gaps_text = "\n".join(
        f"- {g.get('topic')}: {g.get('content_angle', '')} [{g.get('priority', 'medium')}]"
        for g in gaps[:8]
    )

    prompt = f"""You are a content calendar strategist.

BRAND CORE:
{brand_context}

CONTENT GAPS TO ADDRESS:
{gaps_text}

Create {num_topics} specific, ready-to-execute content topics for this brand.
Each topic should have a clear angle that fits the brand voice.

Return ONLY valid JSON:
{{
  "topics": [
    {{
      "title": "<specific content title>",
      "format": "blog post" | "social post" | "video" | "email" | "carousel",
      "platform": "Instagram" | "LinkedIn" | "TikTok" | "all" | "email",
      "hook": "<opening line or angle>",
      "priority": "high" | "medium" | "low"
    }}
  ],
  "calendar_brief": "<2-sentence summary of the content strategy>"
}}"""

    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        return _parse_json_response(response.content[0].text)
    except Exception as exc:
        logger.error("Content topic suggestion failed: %s", exc)
        return {"topics": [], "calendar_brief": ""}
