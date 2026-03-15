from agents.base_agent import BaseAgent


class AgentRegistry:
    """Registry for discovering and retrieving specialist agents."""

    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}
        # Maps keywords in user queries to agent names
        self._keyword_map: dict[str, list[str]] = {}

    def register(self, agent: BaseAgent, keywords: list[str] | None = None) -> None:
        self._agents[agent.name] = agent
        if keywords:
            for kw in keywords:
                self._keyword_map.setdefault(kw.lower(), []).append(agent.name)

    def get_all(self) -> list[BaseAgent]:
        return list(self._agents.values())

    def get_by_name(self, name: str) -> BaseAgent | None:
        return self._agents.get(name)

    def resolve_agents(self, query_text: str) -> list[BaseAgent]:
        """Return agents whose keywords appear in the query. If none match, return all."""
        query_lower = query_text.lower()
        matched_names: set[str] = set()
        for keyword, agent_names in self._keyword_map.items():
            if keyword in query_lower:
                matched_names.update(agent_names)

        if not matched_names:
            return self.get_all()

        return [self._agents[n] for n in matched_names if n in self._agents]
