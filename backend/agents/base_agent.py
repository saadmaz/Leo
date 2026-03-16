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
        
        # Extract the JSON from the text blocks
        content = response.get("content", [])
        text = ""
        for block in content:
            if block["type"] == "text":
                text = block["text"]
                break
        
        if not text:
            # Fallback to check for tool calls or errors
            if "error" in response:
                return {"error": response["error"]}
            return {"error": "No text content returned from LLM"}

        try:
            # Try parsing directly
            return json.loads(text)
        except Exception:
            # Try to find JSON block in markdown
            import re
            json_match = re.search(r'```json\n([\s\S]*?)\n```', text)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except Exception:
                    pass
            
            # Last resort: find anything that looks like { ... }
            bracket_match = re.search(r'(\{[\s\S]*\})', text)
            if bracket_match:
                try:
                    return json.loads(bracket_match.group(1))
                except Exception as e:
                    print(f"ERROR: [{self.name}] Failed to parse any JSON: {e}\nRaw output: {text}")
            
            return {"error": "Failed to parse JSON response"}
