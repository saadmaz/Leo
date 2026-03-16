from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class WinLossAgent(BaseAgent):
    def __init__(self):
        super().__init__("win_loss")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        question = query_context.question

        system_prompt = """
You are a specialist WIN/LOSS INTELLIGENCE analyst for a multi-agent growth intelligence system.
 
Your job:
- Use the web_search tool to find real user feedback, Reddit discussions, Twitter threads, and social signals.
- Identify why users are switching to or away from the product or its competitors.
- Look for "unmet needs" and "missing features" mentioned in social discourse.
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
 
Your specific mission: Find why users switch (win/loss triggers), identify friction points from Reddit/Twitter, and extract unmet needs.
 
Run your searches now. Return AgentOutput JSON.
"""

        try:
            result = await self.chat_with_llm(system_prompt, user_prompt)
            if "error" in result:
                 return AgentOutput(
                    agentId="win_loss",
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
                agentId="win_loss",
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
