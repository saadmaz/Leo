import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.hiring_tools import search_hiring_signals, get_hiring_velocity, get_category_hiring_trends

class HiringSignalAgent(BaseAgent):
    def __init__(self):
        super().__init__("HiringSignalAgent")

    async def run(self, query_context) -> AgentOutput:
        product = query_context.product_name or query_context.company_name or query_context.query
        category = query_context.context.get("category", product)

        # 1. Company Specific Velocity
        velocity = await get_hiring_velocity(product)
        
        # 2. Category Level Trends
        trends = await get_category_hiring_trends(category)
        
        findings = []
        evidence = []
        artifacts = []

        # Company Velocity Finding
        if velocity.get("total_open_roles", 0) > 0:
            ev_id = f"hiring-velocity-{product}"
            evidence.append(Evidence(
                id=ev_id,
                source_type="adzuna",
                url="#",
                title=f"Hiring Velocity: {product}",
                snippet=f"Detected {velocity['total_open_roles']} open roles. Recent titles: {', '.join(velocity['role_titles'][:3])}.",
                collected_at=datetime.utcnow(),
                entity=product,
                tags=["hiring_velocity", "expansion"]
            ))
            findings.append(Finding(
                id=f"f-hiring-{product}",
                statement=f"{product} is actively hiring for {velocity['total_open_roles']} roles, with a focus on {velocity['role_titles'][0] if velocity['role_titles'] else 'growth'}.",
                type="signal",
                confidence="high",
                rationale="Direct job postings counts and titles from Adzuna.",
                domain="Hiring",
                evidence_ids=[ev_id]
            ))

        # Category Trend Finding
        if trends.get("total_postings", 0) > 0:
            ev_id = f"hiring-trends-{category}"
            rb = trends.get("role_breakdown", {})
            evidence.append(Evidence(
                id=ev_id,
                source_type="adzuna",
                url="#",
                title=f"Category Hiring Trends: {category}",
                snippet=f"Market breakdown: {rb}. Top hiring companies: {dict(trends.get('top_hiring_companies', []))}.",
                collected_at=datetime.utcnow(),
                entity=category,
                tags=["market_priority", "hiring_trends"]
            ))
            findings.append(Finding(
                id=f"f-trends-{category}",
                statement=f"Hiring in '{category}' is currently dominated by {max(rb, key=rb.get) if rb else 'engineering'} roles, suggesting a phase of {'product building' if rb.get('engineering', 0) > rb.get('sales', 0) else 'market expansion'}.",
                type="interpretation",
                confidence="medium",
                rationale="Aggregated job posting data reveals functional priorities in the category.",
                domain="Hiring",
                evidence_ids=[ev_id]
            ))

            artifacts.append(Artifact(
                artifact_type="category_hiring_distribution",
                title=f"Hiring Distribution — {category}",
                payload=trends
            ))
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts,
            errors=[]
        )
