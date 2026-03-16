import asyncio
from datetime import datetime
from typing import List, Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.finding_schema import Finding
from backend.tools.hiring_tools import search_hiring_signals, get_hiring_velocity

from backend.schemas.query_schema import QueryRequest
from backend.schemas.source_schema import Source

class HiringSignalAgent(BaseAgent):
    def __init__(self):
        super().__init__("hiring")

    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        product = query_context.product
        company_name = query_context.metadata.get("company_name", product)
        
        system = f"""You are a Hiring Intelligence Agent. 
Your goal is to find hiring signals for {company_name}.
Use the search tools to look for job postings, LinkedIn activity, or press releases about talent acquisition.
Return reasoning and a list of findings in JSON format."""

        user_prompt = f"Analyze the hiring trends and current job openings for '{company_name}'. Is there an aggressive expansion in specific departments like R&D, Sales, or Engineering?"
        
        if status_callback:
            await status_callback({
                "agentId": self.name,
                "status": "running",
                "message": f"Searching for hiring signals and job velocity for {company_name}..."
            })

        # The chat_with_llm handles the tool loop now!
        llm_response = await self.chat_with_llm(system, user_prompt, status_callback=status_callback)
        
        # Parse the structured response from LLM
        findings = []
        for f in llm_response.get("findings", []):
            findings.append(Finding(
                id=f.get("id", f"hiring-{datetime.now().timestamp()}"),
                claim=f.get("claim", ""),
                confidence=f.get("confidence", "medium"),
                rationale=f.get("rationale", ""),
                domain="Hiring",
                sourceIds=f.get("sourceIds", []),
                isFactual=True
            ))

        sources = []
        for s in llm_response.get("sources", []):
            sources.append(Source(
                id=s.get("id"),
                url=s.get("url"),
                title=s.get("title"),
                snippet=s.get("snippet")
            ))

        return AgentOutput(
            agentId=self.name,
            confidence=llm_response.get("confidence", "medium"),
            findings=findings,
            sources=sources,
            facts=llm_response.get("facts", []),
            interpretations=llm_response.get("interpretations", []),
            errors=[]
        )
