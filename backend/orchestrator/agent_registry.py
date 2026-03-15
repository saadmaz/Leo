from typing import Dict, Type
from ..agents.base_agent import BaseAgent
from ..agents.market_trends_agent import MarketTrendsAgent
from ..agents.competitive_agent import CompetitiveLandscapeAgent
from ..agents.adjacent_threat_agent import AdjacentThreatAgent
from ..agents.win_loss_agent import WinLossAgent
from ..agents.pricing_agent import PricingAgent
from ..agents.positioning_agent import PositioningAgent

class AgentRegistry:
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {
            "market_trends": MarketTrendsAgent(),
            "competitive": CompetitiveLandscapeAgent(),
            "adjacent_threat": AdjacentThreatAgent(),
            "win_loss": WinLossAgent(),
            "pricing": PricingAgent(),
            "positioning": PositioningAgent()
        }

    def get_agent(self, name: str) -> BaseAgent:
        return self._agents.get(name)

    def get_all_agents(self) -> Dict[str, BaseAgent]:
        return self._agents
