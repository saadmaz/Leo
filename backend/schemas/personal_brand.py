"""
Pydantic schemas for the Personal Branding Module — Personal Core and related objects.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ---------------------------------------------------------------------------
# Interview
# ---------------------------------------------------------------------------

class InterviewAnswerRequest(BaseModel):
    """A single answer to an interview question."""
    module: str          # "A" | "B" | "C" | "D" | "E"
    questionKey: str     # e.g. "A_what_do_you_do"
    answer: str


class InterviewCompleteRequest(BaseModel):
    """Trigger extraction from all collected interview answers."""
    pass


# ---------------------------------------------------------------------------
# Personal Core sub-models
# ---------------------------------------------------------------------------

class ExpertiseTopic(BaseModel):
    topic: str
    depth: int = 1       # 1=surface, 2=intermediate, 3=deep
    differentiatingAngle: Optional[str] = None


class PersonaAudience(BaseModel):
    role: Optional[str] = None
    industry: Optional[str] = None
    painPoints: List[str] = []
    goals: List[str] = []
    primaryPlatforms: List[str] = []


class ContentPillar(BaseModel):
    name: str
    description: Optional[str] = None
    contentAngles: List[str] = []
    percentage: int = 20          # % of content output for this pillar


class PlatformConfig(BaseModel):
    focusLevel: str = "secondary"   # "primary" | "secondary" | "passive"
    postsPerWeek: int = 2
    contentTypes: List[str] = []
    toneAdjustment: Optional[str] = None


# ---------------------------------------------------------------------------
# Personal Core
# ---------------------------------------------------------------------------

class PersonalCoreCreate(BaseModel):
    fullName: str
    headline: Optional[str] = None
    linkedinUrl: Optional[str] = None


class PersonalCoreUpdate(BaseModel):
    fullName: Optional[str] = None
    headline: Optional[str] = None
    positioningStatement: Optional[str] = None
    uniqueAngle: Optional[str] = None
    originStory: Optional[str] = None
    values: Optional[List[str]] = None
    expertiseTopics: Optional[List[Dict[str, Any]]] = None
    avoidedTopics: Optional[List[str]] = None
    targetAudience: Optional[Dict[str, Any]] = None
    contentPillars: Optional[List[Dict[str, Any]]] = None
    platformStrategy: Optional[Dict[str, Any]] = None
    brandGoals: Optional[List[str]] = None
    goal90Day: Optional[str] = None
    goal12Month: Optional[str] = None
    admiredVoices: Optional[List[str]] = None
    antiVoices: Optional[List[str]] = None
    nicheTiredTopics: Optional[List[str]] = None


class PersonalCore(BaseModel):
    projectId: str
    fullName: str
    headline: Optional[str] = None
    linkedinUrl: Optional[str] = None
    positioningStatement: Optional[str] = None
    uniqueAngle: Optional[str] = None
    originStory: Optional[str] = None
    values: List[str] = []
    credentialHighlights: List[str] = []
    expertiseTopics: List[Dict[str, Any]] = []
    avoidedTopics: List[str] = []
    targetAudience: Optional[Dict[str, Any]] = None
    secondaryAudiences: List[Dict[str, Any]] = []
    contentPillars: List[Dict[str, Any]] = []
    platformStrategy: Dict[str, Any] = {}
    brandGoals: List[str] = []
    goal90Day: Optional[str] = None
    goal12Month: Optional[str] = None
    admiredVoices: List[str] = []
    antiVoices: List[str] = []
    nicheTiredTopics: List[str] = []
    # Interview state
    interviewStatus: str = "not_started"   # "not_started" | "in_progress" | "complete"
    interviewAnswers: Dict[str, str] = {}
    interviewProgress: int = 0             # 0-100
    # Enrichment
    enrichmentStatus: str = "pending"      # "pending" | "running" | "complete" | "error"
    # Scoring
    completenessScore: int = 0
    version: int = 1
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
