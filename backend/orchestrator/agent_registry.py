from typing import Dict, Type
from backend.agents.base_agent import BaseAgent
from backend.agents.market_trends_agent import MarketTrendsAgent
from backend.agents.competitive_agent import CompetitiveLandscapeAgent
from backend.agents.adjacent_threat_agent import AdjacentThreatAgent
from backend.agents.win_loss_agent import WinLossAgent
from backend.agents.pricing_agent import PricingAgent
from backend.agents.positioning_agent import PositioningAgent
from backend.agents.hiring_signal_agent import HiringSignalAgent

class AgentRegistry:
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {
            "market_trends": MarketTrendsAgent(),
            "competitive": CompetitiveLandscapeAgent(),
            "adjacent_threat": AdjacentThreatAgent(),
            "win_loss": WinLossAgent(),
            "pricing": PricingAgent(),
            "positioning": PositioningAgent(),
            "hiring_signal": HiringSignalAgent()
        }

    def get_agent(self, name: str) -> BaseAgent:
        return self._agents.get(name)

    def get_all_agents(self) -> Dict[str, BaseAgent]:
        return self._agents
