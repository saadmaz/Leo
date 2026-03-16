from typing import Dict, Any
from backend.agents.base_agent import BaseAgent
from backend.schemas.agent_output import AgentOutput
from backend.schemas.query_schema import QueryRequest

class PositioningAgent(BaseAgent):
    def __init__(self):
        super().__init__("positioning")

    async def run(self, query_context: QueryRequest) -> AgentOutput:
        product = query_context.product
        domain = query_context.domain
        question = query_context.question

        system_prompt = """
You are a specialist POSITIONING & MESSAGING analyst for a multi-agent growth intelligence system.
 
Your job:
- Use the web_search tool to "teardown" the landing pages and marketing materials of the product and its competitors.
- Identify core value propositions, target personas, and key messaging hooks.
- Compare how different competitors position themselves (e.g., fastest, cheapest, most secure).
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
 
Your specific mission: Perform teardowns of landing pages, identify core value props, and analyze target personas & hooks.
 
Run your searches now. Return AgentOutput JSON.
"""

        try:
            result = await self.chat_with_llm(system_prompt, user_prompt)
            if "error" in result:
                 return AgentOutput(
                    agentId="positioning",
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
                agentId="positioning",
                confidence="low",
                findings=[],
                sources=[],
                facts=[],
                interpretations=[],
                errors=[str(e)]
            )
