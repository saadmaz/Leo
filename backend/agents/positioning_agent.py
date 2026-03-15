import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.search_tools import search_web, search_reddit
from backend.tools.techstack_tools import analyze_gtm_signals

class PositioningAgent(BaseAgent):
    def __init__(self):
        super().__init__("PositioningAgent")

    async def run(self, query_context) -> AgentOutput:
        product = query_context.product_name or query_context.company_name or query_context.query
        domain = query_context.context.get("domain") or f"{product.lower().replace(' ', '')}.com"

        # 1. Collect Messaging data
        search_query = f"{product} ads messaging value proposition"
        
        # 2. Collect GTM/Tech Stack data
        results = await asyncio.gather(
            search_web(search_query),
            search_reddit(f"{product} reviews"),
            analyze_gtm_signals(domain)
        )
        web_results, reddit_results, gtm_data = results
        
        findings = []
        evidence = []
        artifacts = []

        # Tech Stack Findings
        if "error" not in gtm_data:
            ev_id = f"gtm-{domain}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="builtwith/firecrawl",
                url=f"https://{domain}",
                title=f"GTM Stack Analysis: {domain}",
                snippet=f"Detected signals: {', '.join(gtm_data.get('stack_signals', []))}. Raw stack: {gtm_data.get('raw_stack', {}).get('technologies', [])[:10]}",
                collected_at=datetime.utcnow(),
                entity=product,
                tags=["gtm_strategy", "tech_stack"]
            ))
            
            for signal in gtm_data.get("stack_signals", []):
                findings.append(Finding(
                    id=f"f-gtm-{signal.lower().replace(' ', '-')}",
                    statement=f"Inferred GTM Strategy for {product}: {signal}.",
                    type="interpretation",
                    confidence="medium",
                    rationale="GTM strategy inferred from the presence of specific enterprise or mid-market software tools.",
                    domain="Positioning",
                    evidence_ids=[ev_id]
                ))

            artifacts.append(Artifact(
                artifact_type="tech_stack_detail",
                title=f"Tech Stack — {domain}",
                payload=gtm_data
            ))

        # Web/Reddit analysis (simplified for now)
        if web_results:
            ev_id = f"web-pos-{product}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="web",
                url=web_results[0].get("url", "#"),
                title=f"Positioning Signal: {web_results[0].get('title')}",
                snippet=web_results[0].get("snippet", ""),
                collected_at=datetime.utcnow(),
                entity=product,
                tags=["messaging"]
            ))
            
            findings.append(Finding(
                id=f"f-messaging-{product}",
                statement=f"Primary messaging angle for {product} revolves around: {web_results[0].get('title')}",
                type="interpretation",
                confidence="medium",
                rationale="Analyzed from search results for company ads and messaging.",
                domain="Positioning",
                evidence_ids=[ev_id]
            ))

        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=[]
        )
