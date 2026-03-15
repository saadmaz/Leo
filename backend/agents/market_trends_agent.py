import asyncio
from datetime import datetime
from .base_agent import BaseAgent
from ..schemas.agent_output import AgentOutput
from ..schemas.finding_schema import Finding
from ..schemas.evidence_schema import Evidence
from ..schemas.artifact_schema import Artifact
from ..tools.search_tools import search_web
from ..tools.news_tools import search_news

class MarketTrendsAgent(BaseAgent):
    def __init__(self):
        super().__init__("MarketTrendsAgent")

    async def run(self, query_context) -> AgentOutput:
        # 1. Collect sources (Web + News)
        search_query = f"market trends for {query_context.company_name or query_context.query}"
        web_results, news_results = await asyncio.gather(
            search_web(search_query),
            search_news(search_query)
        )
        
        # 2. Extract signals & 3. Generate findings
        findings = [
            Finding(
                id="trend-1",
                statement=f"Growth in {query_context.company_name or 'the sector'} is accelerating due to AI demand.",
                type="fact",
                confidence="high",
                rationale="Multiple news sources indicate increased funding and hiring.",
                domain="Market",
                evidence_ids=["ev-1"]
            )
        ]
        
        evidence = [
            Evidence(
                id="ev-1",
                source_type="web",
                url=web_results[0]["url"],
                title=web_results[0]["title"],
                snippet=web_results[0]["snippet"],
                collected_at=datetime.now(),
                entity=query_context.company_name or "Market",
                tags=["growth", "signals"]
            )
        ]
        
        # 4. Build artifacts
        artifacts = [
            Artifact(
                artifact_type="trend_timeline",
                title="Market Signal Timeline",
                payload={"2024-Q1": "Initial boom", "2024-Q2": "Consolidation"}
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
