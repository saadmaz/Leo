"""
GEO (Generative Engine Optimization) and AEO (Answer Engine Optimization) service.

GEO: Optimises content to be cited by AI search engines (ChatGPT, Perplexity, Gemini).
     Measures entity clarity, factual density, structured answers, authority signals.

AEO: Optimises for featured snippets, voice search, and People Also Ask boxes.
     Generates FAQ schema, HowTo schema, and concise paragraph answers.

Both return a 0-100 score + specific improvement suggestions.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# GEO Scoring
# ---------------------------------------------------------------------------

async def score_geo(
    content: str,
    keyword: str,
    project_id: str,
) -> dict:
    """
    Score content for Generative Engine Optimization.

    Checks:
    - Entity density: Are key entities (brand, product, people) clearly named?
    - Factual specificity: Numbers, dates, statistics
    - Direct answer presence: Does content open with a clear answer?
    - Structured clarity: Headers, short paragraphs, definition blocks
    - Authority signals: Citations, original data, expert quotes
    - Keyword alignment: Semantic match with the target keyword

    Returns:
    {
      "geo_score": 0-100,
      "dimensions": { entity_density, factual_specificity, direct_answer,
                      structured_clarity, authority_signals, keyword_alignment },
      "suggestions": [{ "type": str, "issue": str, "fix": str }],
      "summary": str
    }
    """
    from backend.services.llm_service import get_client

    client = get_client()

    # Truncate to 3000 chars for scoring — representative sample
    sample = content[:3000]

    prompt = f"""You are an expert in Generative Engine Optimization (GEO) — the practice of structuring \
content so that AI assistants (ChatGPT, Perplexity, Gemini, Claude) cite it in their responses.

Evaluate the following content for the keyword "{keyword}".

CONTENT:
---
{sample}
---

Score each dimension 0-100:
1. entity_density: Are key entities (brand, product, people, places) explicitly named and defined?
2. factual_specificity: Does the content include concrete numbers, dates, statistics, and specific claims?
3. direct_answer: Does the content provide a clear, concise direct answer in the first paragraph?
4. structured_clarity: Are ideas organized with headers, bullet points, short paragraphs, and definition blocks?
5. authority_signals: Are there citations, original research, expert quotes, or unique data?
6. keyword_alignment: Does the content semantically cover the topic "{keyword}" comprehensively?

Return ONLY valid JSON:
{{
  "geo_score": <weighted average, 0-100>,
  "dimensions": {{
    "entity_density": <0-100>,
    "factual_specificity": <0-100>,
    "direct_answer": <0-100>,
    "structured_clarity": <0-100>,
    "authority_signals": <0-100>,
    "keyword_alignment": <0-100>
  }},
  "suggestions": [
    {{
      "type": "entity" | "fact" | "answer" | "structure" | "authority" | "keyword",
      "issue": "<specific problem found in the content>",
      "fix": "<concrete, actionable fix — e.g. 'Add a definition of X in the second paragraph'>"
    }}
  ],
  "summary": "<2-sentence summary of GEO readiness>"
}}

Return 3-6 suggestions, most impactful first."""

    try:
        response = await client.messages.create(
            model=settings.LLM_CLASSIFICATION_MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        return _parse_json_response(response.content[0].text)
    except Exception as exc:
        logger.error("GEO scoring failed: %s", exc)
        return {"geo_score": 0, "dimensions": {}, "suggestions": [], "summary": f"Scoring failed: {exc}"}


# ---------------------------------------------------------------------------
# AEO Scoring + Schema Generation
# ---------------------------------------------------------------------------

async def score_aeo(
    content: str,
    keyword: str,
    project_id: str,
) -> dict:
    """
    Score content for Answer Engine Optimization and generate FAQ/schema markup.

    Checks:
    - Featured snippet readiness: 40-60 word paragraph answers
    - Question coverage: Are related questions answered?
    - Voice search compatibility: Conversational, concise answers
    - Schema markup: FAQ, HowTo, or Article schema presence
    - People Also Ask coverage: Covers related sub-questions

    Returns:
    {
      "aeo_score": 0-100,
      "dimensions": { snippet_readiness, question_coverage, voice_friendly,
                      schema_coverage, paa_coverage },
      "faq_schema": { "@context": ..., "@type": "FAQPage", ... },
      "suggested_questions": [str],
      "suggestions": [{ "type": str, "issue": str, "fix": str }],
      "summary": str
    }
    """
    from backend.services.llm_service import get_client

    client = get_client()
    sample = content[:3000]

    prompt = f"""You are an expert in Answer Engine Optimization (AEO) — optimising content for \
featured snippets, voice search, and People Also Ask boxes.

Evaluate the following content for the keyword "{keyword}".

CONTENT:
---
{sample}
---

1. Score each dimension 0-100:
   - snippet_readiness: Does the content have 40-60 word direct-answer paragraphs suitable for featured snippets?
   - question_coverage: Does it directly answer the target keyword as a question and related sub-questions?
   - voice_friendly: Is the language conversational enough for voice search results?
   - schema_coverage: Does the content have structured Q&A sections that could be marked up as FAQ schema?
   - paa_coverage: Does it answer "People Also Ask" related queries around the keyword?

2. Extract or generate 4-6 FAQ pairs from the content.

3. List 4-6 related questions (People Also Ask style) the content SHOULD answer but doesn't.

Return ONLY valid JSON:
{{
  "aeo_score": <weighted average, 0-100>,
  "dimensions": {{
    "snippet_readiness": <0-100>,
    "question_coverage": <0-100>,
    "voice_friendly": <0-100>,
    "schema_coverage": <0-100>,
    "paa_coverage": <0-100>
  }},
  "faq_pairs": [
    {{ "question": "<question>", "answer": "<concise 40-60 word answer>" }}
  ],
  "suggested_questions": ["<question the content should address>"],
  "suggestions": [
    {{
      "type": "snippet" | "question" | "voice" | "schema" | "paa",
      "issue": "<specific problem>",
      "fix": "<concrete fix>"
    }}
  ],
  "summary": "<2-sentence AEO readiness summary>"
}}"""

    try:
        response = await client.messages.create(
            model=settings.LLM_CLASSIFICATION_MODEL,
            max_tokens=1800,
            messages=[{"role": "user", "content": prompt}],
        )
        from backend.services.intelligence_service import _parse_json_response
        result = _parse_json_response(response.content[0].text)
    except Exception as exc:
        logger.error("AEO scoring failed: %s", exc)
        return {"aeo_score": 0, "dimensions": {}, "faq_pairs": [], "suggested_questions": [], "suggestions": [], "summary": f"Scoring failed: {exc}"}

    # Build valid JSON-LD FAQ schema from extracted pairs
    faq_pairs = result.get("faq_pairs", [])
    if faq_pairs:
        result["faq_schema"] = _build_faq_schema(faq_pairs)

    return result


def _build_faq_schema(faq_pairs: list[dict]) -> dict:
    """Build JSON-LD FAQPage schema from a list of {question, answer} dicts."""
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": pair.get("question", ""),
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": pair.get("answer", ""),
                },
            }
            for pair in faq_pairs
            if pair.get("question") and pair.get("answer")
        ],
    }


# ---------------------------------------------------------------------------
# Combined SEO + GEO + AEO Score
# ---------------------------------------------------------------------------

async def combined_content_score(
    content: str,
    keyword: str,
    project_id: str,
    seo_score: Optional[int] = None,
) -> dict:
    """
    Run GEO and AEO scoring in parallel and return a combined report.

    seo_score: optional pre-computed SEO score (0-100) — if omitted, estimated from content.

    Returns:
    {
      "combined_score": 0-100,
      "seo_score": int,
      "geo_score": int,
      "aeo_score": int,
      "geo": { full GEO result },
      "aeo": { full AEO result },
      "top_priorities": [{ title, body, score_area }]  # 3 highest-impact fixes
    }
    """
    import asyncio

    geo_result, aeo_result = await asyncio.gather(
        score_geo(content, keyword, project_id),
        score_aeo(content, keyword, project_id),
    )

    geo = geo_result.get("geo_score", 0)
    aeo = aeo_result.get("aeo_score", 0)

    # Estimate SEO score if not provided: keyword density + length heuristic
    if seo_score is None:
        word_count = len(content.split())
        kw_count = content.lower().count(keyword.lower())
        density = (kw_count / max(word_count, 1)) * 100
        # Ideal density: 0.5-2%. Score 0-100 based on proximity to 1%
        density_score = max(0, 100 - abs(density - 1.0) * 40)
        # Length: 1500-3000 words is ideal
        length_score = min(100, (word_count / 1500) * 80) if word_count < 1500 else max(60, 100 - (word_count - 3000) / 50)
        seo_score = int((density_score + length_score) / 2)

    combined = int((seo_score * 0.35) + (geo * 0.35) + (aeo * 0.30))

    # Collect and rank all suggestions across all three areas
    all_suggestions = []
    for s in geo_result.get("suggestions", [])[:3]:
        all_suggestions.append({"title": s.get("fix", ""), "body": s.get("issue", ""), "score_area": "GEO"})
    for s in aeo_result.get("suggestions", [])[:3]:
        all_suggestions.append({"title": s.get("fix", ""), "body": s.get("issue", ""), "score_area": "AEO"})

    # Add a generic SEO note if score is low
    if seo_score < 50:
        all_suggestions.insert(0, {
            "title": "Improve keyword density and content length",
            "body": f"Current estimated SEO score is {seo_score}/100. Aim for 1500+ words with the keyword appearing naturally every 100-150 words.",
            "score_area": "SEO",
        })

    return {
        "combined_score": combined,
        "seo_score": seo_score,
        "geo_score": geo,
        "aeo_score": aeo,
        "geo": geo_result,
        "aeo": aeo_result,
        "top_priorities": all_suggestions[:5],
    }
