from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class PositioningAgent(BaseAgent):
    def __init__(self):
        super().__init__("positioning")

    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        product = query_context.product
        company_name = query_context.metadata.get("company_name", product)
        
        system = f"""You are a Positioning & Messaging Analyst. 
Your goal is to teardown the landing pages and marketing hooks for {company_name}.
Use the web_search tool to find value propositions, customer testimonials, and feature-benefit mappings.
Return reasoning and a list of findings in JSON format."""

        user_prompt = f"Perform a messaging teardown for '{company_name}'. What is their primary unique selling proposition (USP)? Who is their 'hero' persona?"
        
        if status_callback:
            await status_callback({
                "agentId": self.name,
                "status": "running",
                "message": f"Tearing down landing pages and value props for {company_name}..."
            })

        # The chat_with_llm handles the tool loop
        result = await self.chat_with_llm(system, user_prompt, status_callback=status_callback)
        
        from backend.schemas.finding_schema import Finding
        from backend.schemas.source_schema import Source
        from datetime import datetime

        findings = []
        for f in result.get("findings", []):
            findings.append(Finding(
                id=f.get("id", f"position-{datetime.now().timestamp()}"),
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                rationale=f.get("rationale", ""),
                domain="Positioning",
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
