import os
from typing import List, Dict, Any, Optional
import httpx
from .llm_client import Optional # Placeholder for actual client logic

class LLMClient:
    """
    Primitive LLM client to handle structured extraction.
    Currently a wrapper for OpenAI, but extensible to Gemini/Claude.
    """
    def __init__(self, api_key: str, model: str = "gpt-4-turbo-preview"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1/chat/completions"

    async def analyze_data(self, data: Any, prompt: str) -> Dict[str, Any]:
        """
        Sends raw data and a prompt to the LLM to get structured JSON analysis.
        """
        if not self.api_key:
            return {"error": "API key missing", "findings": []}
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are an expert market analyst. Return only valid JSON."},
                {"role": "user", "content": f"{prompt}\n\nRAW DATA:\n{str(data)}"}
            ],
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
                result = response.json()
                # Parse the content as JSON (assuming the LLM followed instructions)
                import json
                return json.loads(result["choices"][0]["message"]["content"])
            except Exception as e:
                return {"error": str(e), "findings": []}

# Simple factory or global instance could be added here
