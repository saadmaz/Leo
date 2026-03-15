import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # --- Core API Keys ---
    SERPAPI_API_KEY: Optional[str] = None
    FIRECRAWL_API_KEY: Optional[str] = None
    NEWSAPI_KEY: Optional[str] = None
    
    # --- Financial & Corporate ---
    CRUNCHBASE_API_KEY: Optional[str] = None
    
    # --- Hiring & Social ---
    ADZUNA_APP_ID: Optional[str] = None
    ADZUNA_APP_KEY: Optional[str] = None
    REDDIT_CLIENT_ID: Optional[str] = None
    REDDIT_CLIENT_SECRET: Optional[str] = None
    HUNTER_API_KEY: Optional[str] = None
    REDDIT_USER_AGENT: str = "LeoIntelligenceAgent/1.0"
    
    # --- Ads & IP ---
    LINKEDIN_ADS_TOKEN: Optional[str] = None
    META_AD_LIBRARY_TOKEN: Optional[str] = None
    USPTO_API_KEY: Optional[str] = None
    
    # --- LLM Settings ---
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    DEFAULT_MODEL: str = "gpt-4-turbo-preview"
    
    # --- System Config ---
    LOG_LEVEL: str = "INFO"
    TIMEOUT_SECONDS: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
