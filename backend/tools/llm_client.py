import os
import json
from typing import List, Dict, Any, Optional
import httpx
from backend.config import settings

class LLMClient:
    """
    Anthropic LLM client with web_search tool capability.
    """
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.model = model
        self.base_url = "https://api.anthropic.com/v1/messages"

    async def chat(self, messages: List[Dict[str, str]], system: str, tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generic chat interface for Anthropic.
        """
        if not self.api_key or "your_" in self.api_key:
            # Heuristic fallback if API key is missing
            return {"content": [{"type": "text", "text": '{"findings": [], "note": "API Key missing"}'}]}

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        payload = {
            "model": self.model,
            "max_tokens": 4000,
            "system": system,
            "messages": messages
        }
        if tools:
            payload["tools"] = tools

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"ERROR: [LLM] Anthropic request failed: {e}")
                return {"error": str(e)}

    async def analyze_data(self, data: Any, prompt: str) -> Dict[str, Any]:
        """
        Legacy analyzer wrapper, now using Anthropic.
        """
        system = "You are an expert market analyst. Return ONLY valid JSON."
        user_content = f"{prompt}\n\nRAW DATA:\n{json.dumps(data, indent=2)}"
        messages = [{"role": "user", "content": user_content}]
        
        response = await self.chat(messages, system)
        if "error" in response:
            return {"error": response["error"]}
        
        # Extract text content
        content = response.get("content", [])
        text = ""
        for block in content:
            if block["type"] == "text":
                text = block["text"]
                break
        
        try:
            return json.loads(text)
        except Exception as e:
            print(f"ERROR: [LLM] Failed to parse JSON: {e}\nRaw output: {text}")
            return {"error": "Failed to parse JSON response"}
