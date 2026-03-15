import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.search_tools import search_web
from backend.tools.crunchbase_tools import get_company_detail, search_organizations
from backend.tools.domain_tools import get_team_composition

class CompetitiveLandscapeAgent(BaseAgent):
    def __init__(self):
        super().__init__("CompetitiveLandscapeAgent")

    async def run(self, query_context) -> AgentOutput:
        product = query_context.product_name or query_context.company_name or query_context.query
        
        # 1. Advanced Competitor Search (Crunchbase)
        cb_keyword = query_context.context.get("category", product)
        competitors_cb = await search_organizations(cb_keyword, limit=5)
        
        # 2. Team Composition (Hunter.io)
        # Using a domain from the context or inferred from product url
        domain = query_context.context.get("domain") or f"{product.lower().replace(' ', '')}.com"
        team_data = await get_team_composition(domain)
        
        # 3. Web Search
        search_query = f"competitors of {product}"
        raw_results = await search_web(search_query)

        findings = []
        evidence = []
        artifacts = []

        # Add Crunchbase Findings
        for comp in competitors_cb:
            props = comp.get("properties", {})
            cb_id = props.get("identifier", {}).get("value")
            if cb_id:
                ev_id = f"cb-{cb_id}"
                evidence.append(Evidence(
                    id=ev_id,
                    source_type="crunchbase",
                    url=f"https://www.crunchbase.com/organization/{cb_id}",
                    title=f"Crunchbase Profile: {cb_id}",
                    snippet=props.get("short_description", ""),
                    collected_at=datetime.utcnow(),
                    entity=cb_id,
                    tags=["competitor", "funding"]
                ))
                findings.append(Finding(
                    id=f"f-cb-{cb_id}",
                    statement=f"Competitor identified: {cb_id}. Funding: {props.get('funding_total', {}).get('value_usd', 'Unknown')}.",
                    type="fact",
                    confidence="high",
                    rationale="Direct match from Crunchbase organization search.",
                    domain="Competition",
                    evidence_ids=[ev_id]
                ))

        # Add Hunter.io Signal
        if "error" not in team_data:
            ev_id = f"hunter-{domain}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="hunter.io",
                url=f"https://hunter.io/search/{domain}",
                title=f"Team Composition Analysis — {domain}",
                snippet=f"Detected department breakdown: {team_data.get('department_breakdown')}. Total emails: {team_data.get('total_emails_found')}.",
                collected_at=datetime.utcnow(),
                entity=product,
                tags=["team_signal", "org_structure"]
            ))
            findings.append(Finding(
                id=f"f-hunter-{domain}",
                statement=f"Organization structure for {product} indicates heavy focus on {max(team_data.get('department_breakdown', {}), key=team_data.get('department_breakdown', {}).get) if team_data.get('department_breakdown') else 'Unknown'} based on email footprint.",
                type="interpretation",
                confidence="medium",
                rationale="Departmental focus inferred from professional email distributions.",
                domain="Competition",
                evidence_ids=[ev_id]
            ))
            
            artifacts.append(Artifact(
                artifact_type="team_composition",
                title=f"Team Breakdown — {domain}",
                payload=team_data
            ))
        
        # LLM Analysis
        all_raw_data = {"search": raw_results, "crunchbase": competitors_cb}
        llm_analysis = await self.analyze_with_llm(
            data=all_raw_data, 
            query=search_query, 
            context_type="Competitive Landscape"
        )
        
        raw_findings = llm_analysis.get("findings", [])
        findings = []
        evidence = []
        
        for i, f in enumerate(raw_findings):
            findings.append(
                Finding(
                    id=f"comp-{i}",
                    statement=f.get("statement", ""),
                    type=f.get("type", "fact"),
                    confidence=f.get("confidence", "low"),
                    rationale=f.get("rationale", ""),
                    domain="Competition",
                    evidence_ids=[f"ev-comp-{i}"]
                )
            )
            
            # Use search result or placeholder
            source = raw_results[0] if raw_results else {"url": "#", "title": "Crunchbase Intel", "snippet": str(cb_data)}
            evidence.append(
                Evidence(
                    id=f"ev-comp-{i}",
                    source_type="web/crunchbase",
                    url=source.get("url", "#"),
                    title=source.get("title", "Competitive Signal"),
                    snippet=source.get("snippet", ""),
                    collected_at=datetime.now(),
                    entity=query_context.company_name or "Competitor",
                    tags=["feature", "threat"]
                )
            )
        
        artifacts = [
            Artifact(
                artifact_type="competitor_matrix",
                title="Feature Comparison Matrix",
                payload=[{"feature": "AI Strategy", "Status": "Extracted via LLM"}]
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
