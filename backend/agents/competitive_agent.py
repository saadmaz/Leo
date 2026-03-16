from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class CompetitiveLandscapeAgent(BaseAgent):
    def __init__(self):
        super().__init__("competitive")

    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        company_name = query_context.metadata.get("company_name", product)
        
        system = f"""You are a Competitive Intelligence Agent. 
Your goal is to identify direct and indirect competitors for {company_name}.
Use the web_search tool to find pricing pages, feature comparisons, and recent news about competitors.
Return reasoning and a list of findings in JSON format."""

        user_prompt = f"Map the competitive landscape for '{company_name}' in the {domain} space. Highlight 3-5 key competitors and their core value propositions."
        
        if status_callback:
            await status_callback({
                "agentId": self.name,
                "status": "running",
                "message": f"Mapping direct and indirect competitors for {company_name}..."
            })

        # The chat_with_llm handles the tool loop
        result = await self.chat_with_llm(system, user_prompt, status_callback=status_callback)
        
        from backend.schemas.finding_schema import Finding
        from backend.schemas.source_schema import Source
        from datetime import datetime

        findings = []
        for f in result.get("findings", []):
            findings.append(Finding(
                id=f.get("id", f"comp-{datetime.now().timestamp()}"),
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                rationale=f.get("rationale", ""),
                domain="Competitive",
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
