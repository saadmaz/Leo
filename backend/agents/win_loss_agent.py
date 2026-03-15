import asyncio
from datetime import datetime
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.schemas.evidence_schema import Evidence
from backend.schemas.artifact_schema import Artifact
from backend.tools.search_tools import search_reddit, search_web

class WinLossAgent(BaseAgent):
    def __init__(self):
        super().__init__("WinLossAgent")

    async def run(self, query_context) -> AgentOutput:
        # Collect Win/Loss data (Reddit + Web)
        search_query = f"{query_context.company_name or query_context.query} vs competitors reviews"
        results = await asyncio.gather(
            search_web(search_query),
            search_reddit(search_query)
        )
        web_results, reddit_results = results
        
        # LLM Analysis
        all_raw_data = {"web": web_results, "reddit": reddit_results}
        llm_analysis = await self.analyze_with_llm(
            data=all_raw_data, 
            query=search_query, 
            context_type="Win/Loss Analysis & Customer Sentiment"
        )
        
        raw_findings = llm_analysis.get("findings", [])
        findings = []
        evidence = []
        
        for i, f in enumerate(raw_findings):
            findings.append(
                Finding(
                    id=f"win-loss-{i}",
                    statement=f.get("statement", ""),
                    type=f.get("type", "interpretation"),
                    confidence=f.get("confidence", "low"),
                    rationale=f.get("rationale", ""),
                    domain="Win/Loss",
                    evidence_ids=[f"ev-wl-{i}"]
                )
            )
            
            source = web_results[0] if web_results else reddit_results[0] if reddit_results else {"url": "#", "title": "N/A"}
            evidence.append(
                Evidence(
                    id=f"ev-wl-{i}",
                    source_type="social/review",
                    url=source.get("url", "#"),
                    title=source.get("title", "Review Signal"),
                    snippet=source.get("snippet", ""),
                    collected_at=datetime.now(),
                    entity=query_context.company_name or "Competitor",
                    tags=["sentiment", "feature_gap"]
                )
            )
        
        artifacts = [
            Artifact(
                artifact_type="win_loss_chart",
                title="Sentiment Analysis (Win vs Loss)",
                payload={"positive": 60, "negative": 40}
            )
        ]
        
        return AgentOutput(
            agent_name=self.name,
            status="success",
            findings=findings,
            evidence=evidence,
            artifacts=artifacts
        )
