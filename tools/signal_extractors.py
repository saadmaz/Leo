"""
Signal extraction helpers for pricing, positioning, and review analysis.
Pattern-matching based — no LLM calls required.
"""

import re


# ── Pricing signals ──────────────────────────────────────────────

PRICING_PATTERNS: dict[str, list[str]] = {
    "free_trial": [r"free trial", r"try free", r"start free", r"\d+ day trial"],
    "free_plan": [r"free plan", r"free tier", r"free forever", r"\$0"],
    "contact_sales": [r"contact sales", r"talk to sales", r"get a quote", r"request demo", r"book a demo"],
    "usage_based": [r"usage.based", r"pay.as.you.go", r"per api call", r"metered"],
    "seat_based": [r"per user", r"per seat", r"/user/mo", r"per member"],
    "enterprise": [r"enterprise", r"custom pricing", r"custom plan"],
    "tiered": [r"starter|pro|business|growth|scale|premium|plus", r"basic plan"],
}


def detect_pricing_signals(text: str) -> list[dict]:
    """Scan text for pricing model indicators. Returns list of signal dicts."""
    text_lower = text.lower()
    signals = []
    for signal_type, patterns in PRICING_PATTERNS.items():
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                signals.append({
                    "signal": signal_type,
                    "matched": matches[0],
                    "count": len(matches),
                })
                break  # one match per signal type is enough
    return signals


# ── Positioning signals ──────────────────────────────────────────

POSITIONING_PATTERNS: dict[str, list[str]] = {
    "speed_claim": [r"fast(?:er|est)?", r"real.time", r"instant", r"in minutes", r"lightning"],
    "simplicity_claim": [r"simple", r"easy", r"no.code", r"intuitive", r"seamless"],
    "ai_claim": [r"\bai\b", r"ai.powered", r"ai.native", r"machine learning", r"intelligent"],
    "security_claim": [r"soc.?2", r"hipaa", r"gdpr", r"enterprise.grade security", r"compliant"],
    "scale_claim": [r"scale", r"scalable", r"millions", r"enterprise.ready"],
    "integration_claim": [r"integrat", r"connect", r"plug.and.play", r"ecosystem"],
    "roi_claim": [r"\broi\b", r"save.*time", r"save.*money", r"increase.*revenue", r"reduce.*cost"],
}

OVERUSED_PHRASES = [
    "all-in-one", "next-generation", "cutting-edge", "world-class",
    "best-in-class", "game-changing", "revolutionary", "disruptive",
    "end-to-end", "seamless", "frictionless",
]


def detect_positioning_signals(text: str) -> dict:
    """Analyze text for positioning themes, overused phrases, and ICP hints."""
    text_lower = text.lower()

    claims: dict[str, int] = {}
    for claim_type, patterns in POSITIONING_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                claims[claim_type] = claims.get(claim_type, 0) + len(re.findall(pattern, text_lower))
                break

    overused = [phrase for phrase in OVERUSED_PHRASES if phrase in text_lower]

    # ICP detection
    icp_hints = []
    icp_patterns = {
        "enterprise": r"enterprise|large org",
        "smb": r"\bsmb\b|small business|startup",
        "developer": r"developer|engineer|devops|dev team",
        "marketer": r"market(?:er|ing)|growth team",
        "sales": r"sales team|revenue team|sdr|bdr",
    }
    for icp, pattern in icp_patterns.items():
        if re.search(pattern, text_lower):
            icp_hints.append(icp)

    return {
        "claims": claims,
        "overused_phrases": overused,
        "icp_hints": icp_hints,
    }


# ── Review / win-loss signals ────────────────────────────────────

REVIEW_PATTERNS: dict[str, list[str]] = {
    "too_expensive": [r"too expensive", r"overpriced", r"not worth the price", r"costly"],
    "missing_integrations": [r"missing integrations?", r"doesn't integrate", r"no integration", r"wish.*integrat"],
    "unreliable": [r"unreliable", r"buggy", r"crashes", r"downtime", r"outage", r"broken"],
    "bad_onboarding": [r"hard to set up", r"onboarding.*difficult", r"steep learning curve", r"confusing setup"],
    "poor_support": [r"poor support", r"bad support", r"slow support", r"no response", r"unresponsive"],
    "setup_complexity": [r"complex setup", r"complicated", r"took.*hours to configure", r"difficult.*deploy"],
    "weak_roi": [r"not worth", r"didn't see value", r"waste of money", r"low roi"],
    "switching": [r"switch(?:ed|ing) (?:to|from)", r"moved (?:to|from)", r"migrat(?:ed|ing) (?:to|from)", r"replaced.*with"],
}


def detect_review_signals(text: str) -> list[dict]:
    """Scan review/discussion text for buyer pain signals."""
    text_lower = text.lower()
    signals = []
    for signal_type, patterns in REVIEW_PATTERNS.items():
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                # Extract surrounding context for the first match
                match_obj = re.search(pattern, text_lower)
                start = max(0, match_obj.start() - 50)
                end = min(len(text_lower), match_obj.end() + 50)
                context = text_lower[start:end].strip()
                signals.append({
                    "signal": signal_type,
                    "matched": matches[0],
                    "count": len(matches),
                    "context": f"...{context}...",
                })
                break
    return signals
