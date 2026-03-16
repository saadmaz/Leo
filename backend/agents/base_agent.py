from abc import ABC, abstractmethod
from typing import List, Any, Dict, Optional
from backend.schemas.query_schema import QueryRequest
from backend.schemas.agent_output import AgentOutput
from backend.tools.llm_client import LLMClient
from backend.config import settings
import json

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.llm = LLMClient(api_key=settings.ANTHROPIC_API_KEY)

    @abstractmethod
    async def run(self, query_context: QueryRequest) -> AgentOutput:
        pass

    async def chat_with_llm(self, system: str, user_prompt: str) -> Dict[str, Any]:
        """
        Helper to run an agent mission with the Anthropic web_search tool.
        """
        messages = [{"role": "user", "content": user_prompt}]
        tools = [{
            "type": "web_search_20250305",
            "name": "web_search"
        }]
        
        response = await self.llm.chat(messages, system, tools=tools)
        return self.llm.extract_json(response)
