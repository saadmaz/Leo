"""
Competitor Blog Analysis Service.

Crawls competitor blog indexes with Firecrawl, extracts top-performing posts,
analyses themes, formats, and topic gaps vs. the brand's content.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from backend.config import settings

logger = logging.getLogger(__name__)


async def analyse_competitor_blogs(
    project_id: str,
    brand_core: dict,
    competitor_urls: list[str],
    topic_focus: Optional[str] = None,
) -> dict:
    """
    For each competitor URL, crawl their blog and extract post metadata.
    Then use Claude to identify:
    - Top-performing content formats (long-form guides vs listicles vs case studies)
    - Most common topics
    - Content gaps the brand can exploit
    - Estimated posting frequency

    Returns:
    {
      "competitors": [
        {
          "domain": str,
          "posts": [{ "title": str, "url": str, "estimated_topic": str, "format": str }],
          "top_formats": [str],
          "top_topics": [str],
          "posting_frequency": str,
        }
      ],
      "gap_opportunities": [{ "topic": str, "angle": str, "why_now": str, "priority": str }],
      "recommended_formats": [str],
      "summary": str
    }
    """
    from backend.services.llm_service import get_client, build_brand_core_context

    client = get_client()
    brand_context = build_brand_core_context(brand_core)
    competitor_data = []

    for url in competitor_urls[:4]:
        domain = _extract_domain(url)
        blog_url = _guess_blog_url(url)
        posts = await _crawl_blog_index(blog_url, project_id)
        if posts:
            competitor_data.append({"domain": domain, "url": url, "posts": posts})

    if not competitor_data:
        return {
            "competitors": [],
            "gap_opportunities": [],
            "recommended_formats": [],
            "summary": "Could not crawl competitor blogs. Check that URLs are accessible.",
        }

    # Build prompt payload
    comp_sections = []
    for comp in competitor_data:
        titles = "\n".join(f"- {p['title']}" for p in comp["posts"][:15])
        comp_sections.append(f"COMPETITOR: {comp['domain']}\nRECENT POSTS:\n{titles}")

    prompt = f"""You are a content strategist. Analyse these competitor blogs and identify opportunities for this brand.

BRAND CORE:
{brand_context}

COMPETITOR BLOGS:
{chr(10).join(comp_sections)}

{f'TOPIC FOCUS: {topic_focus}' if topic_focus else ''}

For each competitor, identify:
1. Their dominant content formats (long-form guide, listicle, case study, how-to, opinion, news)
2. Their top 5 recurring topics
3. Estimated posting frequency based on recency signals in titles

Then identify 5-8 content gap opportunities the brand should create content for, considering what competitors are doing well that the brand isn't covering.

Return ONLY valid JSON:
{{
  "competitors": [
    {{
      "domain": "<domain>",
      "top_formats": ["<format>"],
      "top_topics": ["<topic>"],
      "posting_frequency": "daily" | "2-3x/week" | "weekly" | "bi-weekly" | "monthly",
      "content_style": "<1-sentence description of their content style>"
    }}
  ],
  "gap_opportunities": [
    {{
      "topic": "<specific topic title the brand should write about>",
      "angle": "<unique angle the brand can take that differs from competitors>",
      "why_now": "<why this topic is timely or strategic>",
      "target_format": "long-form guide" | "listicle" | "case study" | "how-to" | "opinion" | "news",
      "priority": "high" | "medium" | "low"
    }}
  ],
  "recommended_formats": ["<format that performs best in this niche>"],
  "summary": "<3-sentence strategic summary of competitive content landscape>"
}}"""

    try:
        response = await client.messages.create(
            model=settings.LLM_CHAT_MODEL,
            max_tokens=2500,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        result = _parse_json_response(response.content[0].text)
    except Exception as exc:
        logger.error("Competitor blog analysis LLM failed: %s", exc)
        result = {"competitors": [], "gap_opportunities": [], "recommended_formats": [], "summary": str(exc)}

    # Enrich competitors with raw post lists
    for comp_result in result.get("competitors", []):
        raw = next((c for c in competitor_data if c["domain"] == comp_result.get("domain")), None)
        if raw:
            comp_result["posts"] = raw["posts"][:10]

    return result


async def _crawl_blog_index(blog_url: str, project_id: str) -> list[dict]:
    """
    Use Firecrawl to crawl a blog index page and extract post titles/URLs.
    Falls back to Exa search if Firecrawl fails.
    """
    # Try Firecrawl first
    try:
        import httpx
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"},
                json={
                    "url": blog_url,
                    "formats": ["links", "markdown"],
                    "onlyMainContent": True,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                links = data.get("data", {}).get("links", [])
                markdown = data.get("data", {}).get("markdown", "")
                posts = _extract_posts_from_links(links, blog_url)
                if not posts:
                    posts = _extract_posts_from_markdown(markdown, blog_url)
                if posts:
                    return posts[:20]
    except Exception as exc:
        logger.warning("Firecrawl blog crawl failed for %s: %s", blog_url, exc)

    # Fallback: Exa search for recent posts
    try:
        from backend.services.integrations import exa_client
        domain = _extract_domain(blog_url)
        results = await exa_client.search(
            query=f"site:{domain} blog",
            num_results=15,
            project_id=project_id,
        )
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "estimated_topic": "",
                "format": "unknown",
            }
            for r in results
            if r.get("title")
        ][:15]
    except Exception as exc:
        logger.warning("Exa fallback for %s failed: %s", blog_url, exc)
        return []


def _extract_posts_from_links(links: list, base_url: str) -> list[dict]:
    """Extract blog post links from a Firecrawl links response."""
    base_domain = _extract_domain(base_url)
    posts = []
    for link in links:
        href = link if isinstance(link, str) else link.get("href", "")
        text = "" if isinstance(link, str) else link.get("text", "")
        if not href or not text:
            continue
        # Filter to likely blog post URLs (not category/tag/archive pages)
        if _extract_domain(href) != base_domain:
            continue
        path = urlparse(href).path
        # Skip short paths (category pages, archives)
        if len(path.strip("/").split("/")) < 2:
            continue
        if any(x in path for x in ["/tag/", "/category/", "/author/", "/page/", "?", "#"]):
            continue
        posts.append({"title": text.strip(), "url": href, "estimated_topic": "", "format": "unknown"})
    return posts


def _extract_posts_from_markdown(markdown: str, base_url: str) -> list[dict]:
    """Extract post titles from markdown content using link pattern matching."""
    pattern = re.compile(r'\[([^\]]{10,120})\]\((https?://[^\)]+)\)')
    base_domain = _extract_domain(base_url)
    posts = []
    seen = set()
    for m in pattern.finditer(markdown):
        title, url = m.group(1).strip(), m.group(2).strip()
        if url in seen:
            continue
        seen.add(url)
        if _extract_domain(url) != base_domain:
            continue
        path = urlparse(url).path
        if len(path.strip("/").split("/")) < 2:
            continue
        posts.append({"title": title, "url": url, "estimated_topic": "", "format": "unknown"})
    return posts[:20]


def _extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return parsed.netloc.replace("www.", "")
    except Exception:
        return url


def _guess_blog_url(url: str) -> str:
    """Attempt to guess the blog index URL from a domain."""
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    base = f"{parsed.scheme}://{parsed.netloc}"
    # If url already has a /blog path component, use it directly
    if "/blog" in parsed.path:
        return url
    return f"{base}/blog"
