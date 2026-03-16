from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class MarketTrendsAgent(BaseAgent):
    def __init__(self):
        super().__init__("market_trends")

    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        company_name = query_context.metadata.get("company_name", product)
        
        system = f"""You are a Market & Trends Analyst. 
Your goal is to find macroeconomic trends and specific category growth signals for {company_name}.
Use the web_search tool to find recent funding, market reports, and trend indicators.
Return reasoning and a list of findings in JSON format."""

        user_prompt = f"Analyze the market direction and growth signals for '{company_name}' operating in {domain}. Find 3-5 high-impact trends affecting this space in 2025-2026."
        
        if status_callback:
            await status_callback({
                "agentId": self.name,
                "status": "running",
                "message": f"Analyzing market tailwinds and growth signals for {company_name}..."
            })

        # The chat_with_llm handles the tool loop
        result = await self.chat_with_llm(system, user_prompt, status_callback=status_callback)
        
        from backend.schemas.finding_schema import Finding
        from backend.schemas.source_schema import Source
        from datetime import datetime

        findings = []
        for f in result.get("findings", []):
            findings.append(Finding(
                id=f.get("id", f"market-{datetime.now().timestamp()}"),
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                rationale=f.get("rationale", ""),
                domain="Market",
                sourceIds=f.get("sourceIds", []),
                isFactual=True
            ))

        sources = []
        for s in result.get("sources", []):
            sources.append(Source(
                id=s.get("id"),
                url=s.get("url"),
                title=s.get("title"),
                snippet=s.get("snippet")
            ))

        return AgentOutput(
            agentId=self.name,
            confidence=result.get("confidence", "medium"),
            findings=findings,
            sources=sources,
            facts=result.get("facts", []),
            interpretations=result.get("interpretations", []),
            errors=[]
        )
