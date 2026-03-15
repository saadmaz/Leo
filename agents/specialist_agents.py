"""
Specialist agents — re-exports for backward compatibility.
Real implementations live in their own modules.
Placeholder agents (CompetitiveLandscape, MarketTrends, AdjacentThreat) remain here.
"""

import asyncio
import random
from datetime import datetime, timezone

from agents.base_agent import BaseAgent
from schemas.agent_output import AgentOutput, Evidence, Artifact
from schemas.finding_schema import Finding
from schemas.query_schema import QueryRequest

# Re-export real implementations so existing imports keep working
from agents.win_loss_agent import WinLossAgent
from agents.pricing_agent import PricingAgent
from agents.positioning_agent import PositioningAgent


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
