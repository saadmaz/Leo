from abc import ABC, abstractmethod
from typing import List, Any, Dict
from backend.schemas.query_schema import QueryRequest
from backend.schemas.agent_output import AgentOutput
from backend.tools.llm_client import LLMClient
from backend.config import settings

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.llm = LLMClient(api_key=settings.OPENAI_API_KEY)

    @abstractmethod
    async def run(self, query_context: QueryRequest) -> AgentOutput:
        pass

    async def analyze_with_llm(self, data: Any, query: str, context_type: str) -> Dict[str, Any]:
        """
        Helper to analyze raw data using the LLM client with a specific persona.
        """
        prompt = f"""
        Analyze the following raw {context_type} data for the query: "{query}"
        Extract the most important market intelligence findings.
        For each finding, provide:
        - statement (concise fact or signal)
        - type (fact, interpretation, or signal)
        - confidence (low, medium, high)
        - rationale (why this finding is important)
        - domain (e.g., Market, Competition, Hiring, etc.)
        
        Return the results as a JSON object with a 'findings' key.
        """
        return await self.llm.analyze_data(data, prompt)
