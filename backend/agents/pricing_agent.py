from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class PricingAgent(BaseAgent):
    def __init__(self):
        super().__init__("pricing")

    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        product = query_context.product
        company_name = query_context.metadata.get("company_name", product)
        
        system = f"""You are a Pricing & Packaging Analyst. 
Your goal is to extract competitor cost structures and pricing models for {company_name}.
Use the web_search tool to find pricing pages, forum discussions about discounts, and enterprise tier signals.
Return reasoning and a list of findings in JSON format."""

        user_prompt = f"Analyze the pricing strategy for '{company_name}' and its key competitors. Identify if they use usage-based, seat-based, or tiered flat-fee models."
        
        if status_callback:
            await status_callback({
                "agentId": self.name,
                "status": "running",
                "message": f"Extracting cost structures and pricing models for {company_name}..."
            })

        # The chat_with_llm handles the tool loop
        result = await self.chat_with_llm(system, user_prompt, status_callback=status_callback)
        
        from backend.schemas.finding_schema import Finding
        from backend.schemas.source_schema import Source
        from datetime import datetime

        findings = []
        for f in result.get("findings", []):
            findings.append(Finding(
                id=f.get("id", f"pricing-{datetime.now().timestamp()}"),
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                rationale=f.get("rationale", ""),
                domain="Pricing",
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
