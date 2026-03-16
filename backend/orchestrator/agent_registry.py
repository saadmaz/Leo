from typing import Dict
from backend.agents.base_agent import BaseAgent
from backend.agents.market_trends_agent import MarketTrendsAgent
from backend.agents.competitive_agent import CompetitiveLandscapeAgent
from backend.agents.adjacent_threat_agent import AdjacentMarketAgent
from backend.agents.win_loss_agent import WinLossAgent
from backend.agents.pricing_agent import PricingAgent
from backend.agents.positioning_agent import PositioningAgent

class AgentRegistry:
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {
            "market_trends": MarketTrendsAgent(),
            "competitive": CompetitiveLandscapeAgent(),
            "adjacent_market": AdjacentMarketAgent(),
            "win_loss": WinLossAgent(),
            "pricing": PricingAgent(),
            "positioning": PositioningAgent()
        }

    def get_agent(self, name: str) -> BaseAgent:
        return self._agents.get(name)

    def get_all_agents(self) -> Dict[str, BaseAgent]:
        return self._agents
