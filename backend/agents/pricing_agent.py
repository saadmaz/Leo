from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class PricingAgent(BaseAgent):
    def __init__(self):
        super().__init__("PricingAgent")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        question = query_context.question

        system_prompt = """
You are a specialist PRICING & PACKAGING analyst for a multi-agent growth intelligence system.
 
Your job:
- Use the web_search tool to find current pricing pages, discount structures, and contract terms for the product and its competitors.
- Identify "hidden" costs, seat-based vs usage-based models, and public enterprise pricing signals.
- Separate facts (verifiable, sourced) from interpretations (inferred).
- Assign a confidence level to every claim: high / medium / low.
- Cite at least 2-3 source URLs for every major finding.
- Do not use training data. Everything must come from a live web search.
 
Output contract:
- Return ONLY valid JSON matching the AgentOutput schema.
- No preamble. No markdown code fences. No explanation outside the JSON.
"""

        user_prompt = f"""
Product: {product}
Domain: {domain}
Question: {question}
 
Your specific mission: Extract competitor cost structures, identify discounting patterns, and analyze value-to-price ratios.
 
Run your searches now. Return AgentOutput JSON.
"""

        try:
            result = await self.chat_with_llm(system_prompt, user_prompt)
            if "error" in result:
                 return AgentOutput(
                    agentId="pricing",
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
                agentId="pricing",
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
