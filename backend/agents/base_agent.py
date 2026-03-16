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
    async def run(self, query_context: QueryRequest, status_callback=None) -> AgentOutput:
        pass

    async def chat_with_llm(self, system: str, user_prompt: str, status_callback=None) -> Dict[str, Any]:
        """
        Helper to run an agent mission with the Anthropic web_search tool.
        """
        messages = [{"role": "user", "content": user_prompt}]
        tools = [
            {
                "name": "web_search",
                "description": "Search the web for real-time information, competitor news, and market trends.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search query."}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "hiring_search",
                "description": "Search for job openings and hiring signals for specific companies or roles.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Company name or role to search for."},
                        "location": {"type": "string", "description": "Region code, e.g. 'us', 'gb'. Default is 'us'."}
                    },
                    "required": ["query"]
                }
            }
        ]
        
        response = await self.llm.chat(messages, system, tools=tools, status_callback=status_callback)
        return self.llm.extract_json(response)
