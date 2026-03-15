from pydantic import BaseModel


class Artifact(BaseModel):
    """A structured artifact that a frontend could render (chart, table, map, etc.)."""
    artifact_type: str = ""      # e.g. "trend_timeline", "competitor_matrix", "threat_map"
    payload: dict = {}           # freeform dict a frontend component would consume
