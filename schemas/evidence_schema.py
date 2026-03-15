from pydantic import BaseModel, Field
from datetime import datetime, timezone


class Evidence(BaseModel):
    """A piece of evidence collected from an external source."""
    source_type: str = ""        # e.g. "web_search", "reddit", "hackernews", "scraped_page"
    url: str = ""
    title: str = ""
    snippet: str = ""
    collected_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    entity: str = ""             # the company/product/topic this evidence relates to
