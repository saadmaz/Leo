from abc import ABC, abstractmethod

from schemas.agent_output import AgentOutput
from schemas.query_schema import QueryRequest


class BaseAgent(ABC):
    """Abstract base class for all specialist agents."""

    name: str = "BaseAgent"

    @abstractmethod
    async def run(self, query: QueryRequest) -> AgentOutput:
        """Execute the agent's research task and return structured output."""
        ...
