from typing import Dict, Any
from .base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class CompetitiveLandscapeAgent(BaseAgent):
    def __init__(self):
        super().__init__("competitive")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        question = query_context.question

        system_prompt = """
You are a specialist COMPETITIVE LANDSCAPE analyst for a multi-agent growth intelligence system.
 
Your job:
- Use the web_search tool aggressively to find direct and indirect competitors for the given product.
- Identify their product features, pricing models, market share, and recent strategic moves.
- Separate facts (verifiable, sourced) from interpretations (inferred).
- Assign a confidence level to every claim: high / medium / low.
- Cite source URLs for every major finding.
 
Output contract:
- Return ONLY valid JSON matching the AgentOutput schema.
- Finding schema: {id: str, claim: str, confidence: "low"|"medium"|"high", sourceIds: List[str], isFactual: bool, rationale: str, domain: str}
- Source schema: {id: str, url: str, title: str, snippet: str, retrievedAt: ISO_timestamp}
- No preamble. No markdown code fences.
"""

        user_prompt = f"""
Product: {product}
Domain: {domain}
Question: {question}
 
Your specific mission: Find direct/indirect competitors, their features, pricing, and strategic moves.
 
Run your searches now. Return AgentOutput JSON.
"""

        try:
            result = await self.chat_with_llm(system_prompt, user_prompt)
            if "error" in result:
                 return AgentOutput(
                    agentId="competitive",
                    confidence="low",
                    findings=[],
                    sources=[],
                    facts=[],
                    interpretations=[],
                    errors=[result["error"]]
                )
            # Ensure agentId is correct
            result["agentId"] = "competitive"
            return AgentOutput(**result)
        except Exception as e:
            return AgentOutput(
                agentId="competitive",
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
