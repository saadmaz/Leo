from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class AdjacentThreatAgent(BaseAgent):
    def __init__(self):
        super().__init__("adjacent_market")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        question = query_context.question

        system_prompt = """
You are a specialist ADJACENT MARKET analyst for a multi-agent growth intelligence system.
 
Your job:
- Use the web_search tool to identify emerging segments, new geographies, or adjacent product categories.
- Look for M&A possibilities, partnership signals, and technological shifts that open new doors.
- Separate facts (verifiable, sourced) from interpretations (inferred).
- Assign a confidence level to every claim: high / medium / low.
- Cite at least 2-3 source URLs for every major finding.
- Do not use training data. Everything must come from a live web search.
 
Output contract:
- Return ONLY valid JSON matching the AgentOutput schema.
- Finding schema: {id: str, claim: str, confidence: "low"|"medium"|"high", sourceIds: List[str], isFactual: bool, rationale: str, domain: str}
- Source schema: {id: str, url: str, title: str, snippet: str, retrievedAt: ISO_timestamp}
- No preamble. No markdown code fences. No explanation outside the JSON.
"""

        user_prompt = f"""
Product: {product}
Domain: {domain}
Question: {question}
 
Your specific mission: Identify new segments, M&A possibilities, and structural market shifts.
 
Run your searches now. Return AgentOutput JSON.
"""

        try:
            result = await self.chat_with_llm(system_prompt, user_prompt)
            if "error" in result:
                 return AgentOutput(
                    agentId="adjacent_market",
                    confidence="low",
                    findings=[],
                    sources=[],
                    facts=[],
                    interpretations=[],
                    errors=[result["error"]]
                )
            return AgentOutput(**result)
        except Exception as e:
            return AgentOutput(
                agentId="adjacent_market",
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
