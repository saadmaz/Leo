from abc import ABC, abstractmethod
from typing import List
from ..schemas.query_schema import QueryRequest
from ..schemas.agent_output import AgentOutput

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def run(self, query_context: QueryRequest) -> AgentOutput:
        pass
