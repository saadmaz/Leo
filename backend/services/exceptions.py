"""
Custom exceptions for Leo's service layer.

SearchServiceError is raised by exa_client and tavily_client so callers
never need to handle raw third-party SDK exceptions.
"""


class SearchServiceError(Exception):
    """Raised when a web-search or research API call fails."""

    def __init__(self, message: str, source: str, is_retryable: bool = False):
        super().__init__(message)
        self.source = source          # "exa" | "tavily"
        self.is_retryable = is_retryable


class QuotaExceededError(Exception):
    """Raised when a project has hit its daily search quota."""

    def __init__(self, source: str, operation: str):
        super().__init__(f"Daily quota exceeded for {source}/{operation}")
        self.source = source
        self.operation = operation
