from typing import List, Dict, Any
from firecrawl import FirecrawlApp
from backend.config import settings

async def get_tech_stack(domain: str) -> Dict[str, Any]:
    """
    Analyze competitor tech stack using BuiltWith via Firecrawl's scrape function.
    BuiltWith data is usually visible in meta tags or script tags or can be 
    inferred by Firecrawl's advanced scraping.
    """
    if not settings.FIRECRAWL_API_KEY:
        return {"error": "Missing Firecrawl API Key"}

    app = FirecrawlApp(api_key=settings.FIRECRAWL_API_KEY)
    
    # We use firecrawl to scrape the site and specifically look for tech signals
    # In a real BuiltWith integration, we'd use their API, but here we leverage Firecrawl's ability
    # to extract structured data or known script patterns.
    try:
        # Prompting Firecrawl to extract technology stack specifically
        result = app.scrape_url(
            f"https://{domain}",
            params={
                "formats": ["json"],
                "jsonOptions": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "technologies": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of technologies, frameworks, CRMs, and analytics tools used on the site"
                            },
                            "cms": {"type": "string"},
                            "analytics": {"type": "array", "items": {"type": "string"}},
                            "crm": {"type": "string"}
                        }
                    }
                }
            }
        )
        return result
    except Exception as e:
        return {"error": str(e)}

async def analyze_gtm_signals(domain: str) -> Dict[str, Any]:
    """Infers GTM strategy from tech stack (e.g., Salesforce + Segment = Enterprise)."""
    stack = await get_tech_stack(domain)
    if "error" in stack:
        return stack

    techs = [t.lower() for t in stack.get("technologies", [])]
    signals = []

    if any(t in techs for t in ["salesforce", "marketo", "segment", "demandbase"]):
        signals.append("High-end Enterprise GTM")
    if any(t in techs for t in ["hubspot", "mailchimp", "pipedrive"]):
        signals.append("SMB/Mid-market focused")
    if any(t in techs for t in ["intercom", "drift", "zendesk"]):
        signals.append("Heavy focus on Customer Support/Engagement")
    
    return {
        "domain": domain,
        "stack_signals": signals,
        "raw_stack": stack
    }
