"""
Pydantic schemas for the Funnel Strategy Engine.
"""

from typing import Any, Optional
from pydantic import BaseModel


class StrategyStartRequest(BaseModel):
    user_goal: str


class StrategyAnswerRequest(BaseModel):
    question_index: int   # 0 = funnel selection, 1–6 = intake questions
    answer: str
    funnel_type: Optional[str] = None  # set when question_index == 0


class StrategyRefineRequest(BaseModel):
    follow_up_message: str


class StrategyResponse(BaseModel):
    session_id: str
    status: str
    next_question: Optional[dict] = None   # {index, text, placeholder}
    message: Optional[str] = None
