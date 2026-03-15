"""
Placeholder specialist agents.
Each simulates research by generating structured findings.
Replace the run() body with real API calls (e.g., Tavily, SerpAPI) later.
"""

import asyncio
import random
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput, Evidence, Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest


class PricingAgent(BaseAgent):
    name = "PricingAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))  # simulate latency
        company = query.company_name or "the target company"
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement=f"{company} uses a tiered SaaS pricing model with enterprise custom quotes.",
                    type="fact",
                    confidence="medium",
                    rationale="Pricing page lists three tiers; enterprise says 'Contact Sales'.",
                ),
                Finding(
                    statement="Free tier acts as a product-led growth funnel.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Free plan has usage limits designed to drive upgrades.",
                ),
            ],
            evidence=[
                Evidence(
                    source_type="pricing_page",
                    url=f"https://{company.lower().replace(' ', '')}.com/pricing",
                    title=f"{company} Pricing",
                    snippet="Starter $29/mo, Pro $99/mo, Enterprise – Contact Sales",
                ),
                Evidence(
                    source_type="review_site",
                    url="https://g2.com/products/example/pricing",
                    title="G2 Pricing Info",
                    snippet="Users report average deal size of $15k ARR for mid-market.",
                ),
            ],
            artifacts=[
                Artifact(
                    artifact_type="pricing_table",
                    payload={
                        "tiers": [
                            {"name": "Starter", "price": "$29/mo"},
                            {"name": "Pro", "price": "$99/mo"},
                            {"name": "Enterprise", "price": "Custom"},
                        ]
                    },
                )
            ],
        )


class CompetitiveLandscapeAgent(BaseAgent):
    name = "CompetitiveLandscapeAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))
        company = query.company_name or "the target company"
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement=f"{company} competes primarily with 3 established players and 2 emerging startups.",
                    type="fact",
                    confidence="high",
                    rationale="Cross-referenced Crunchbase, G2, and industry reports.",
                ),
                Finding(
                    statement="The market is consolidating; two competitors announced mergers in the last quarter.",
                    type="interpretation",
                    confidence="medium",
                    rationale="News coverage of M&A activity in the space.",
                ),
            ],
            evidence=[
                Evidence(source_type="industry_report", title="Market Map 2026", snippet="Top 5 vendors control 68% of market share."),
                Evidence(source_type="news", title="TechCrunch M&A roundup", snippet="CompetitorA acquires CompetitorB for $200M."),
                Evidence(source_type="g2_grid", title="G2 Grid Report", snippet=f"{company} ranked as High Performer."),
            ],
        )


class MarketTrendsAgent(BaseAgent):
    name = "MarketTrendsAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement="AI-native workflows are the fastest growing segment, up 140% YoY.",
                    type="fact",
                    confidence="high",
                    rationale="Analyst report with primary data from 500+ enterprises.",
                ),
                Finding(
                    statement="Buyer preference is shifting from all-in-one suites to best-of-breed composable tools.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Survey data showing 62% of buyers prefer specialized tools.",
                ),
            ],
            evidence=[
                Evidence(source_type="analyst_report", title="2026 SaaS Trends", snippet="AI-native segment grew 140% YoY."),
                Evidence(source_type="survey", title="Buyer Preference Survey", snippet="62% prefer best-of-breed over suite."),
            ],
        )


class PositioningAgent(BaseAgent):
    name = "PositioningAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))
        company = query.company_name or "the target company"
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement=f"{company}'s messaging emphasizes speed and simplicity but under-indexes on security.",
                    type="interpretation",
                    confidence="medium",
                    rationale="Homepage copy analysis vs. competitor messaging audit.",
                ),
                Finding(
                    statement="Recommend adding a trust/security narrative to the homepage above the fold.",
                    type="recommendation",
                    confidence="medium",
                    rationale="Enterprise buyers list security as top-3 purchase criterion.",
                ),
            ],
            evidence=[
                Evidence(source_type="website", title=f"{company} Homepage", snippet="Ship faster. Build simpler."),
                Evidence(source_type="competitor_website", title="Competitor Homepage", snippet="Enterprise-grade security. SOC2 compliant."),
            ],
        )


class WinLossAgent(BaseAgent):
    name = "WinLossAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement="Top win reason: faster time-to-value vs. incumbent.",
                    type="fact",
                    confidence="medium",
                    rationale="Analysis of 25 closed-won deal notes.",
                ),
                Finding(
                    statement="Top loss reason: missing SSO / SAML support for enterprise deals.",
                    type="fact",
                    confidence="high",
                    rationale="Cited in 8 of 12 closed-lost enterprise opportunities.",
                ),
            ],
            evidence=[
                Evidence(source_type="crm_data", title="Win/Loss Analysis Q1 2026", snippet="67% of wins cite onboarding speed."),
                Evidence(source_type="crm_data", title="Lost Deal Reasons", snippet="SSO gap mentioned in 8/12 enterprise losses."),
            ],
        )


class AdjacentThreatAgent(BaseAgent):
    name = "AdjacentThreatAgent"

    async def run(self, query: QueryRequest) -> AgentOutput:
        await asyncio.sleep(random.uniform(0.3, 1.0))
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=[
                Finding(
                    statement="A major CRM vendor is building native analytics that overlaps with the product's core value prop.",
                    type="fact",
                    confidence="medium",
                    rationale="Product changelog and beta announcement from CRM vendor.",
                ),
                Finding(
                    statement="Recommend accelerating integration partnerships to create switching costs.",
                    type="recommendation",
                    confidence="medium",
                    rationale="Platform lock-in is the primary moat for adjacent entrants.",
                ),
            ],
            evidence=[
                Evidence(source_type="changelog", title="CRM Vendor Beta Release Notes", snippet="New embedded analytics module."),
            ],
        )
