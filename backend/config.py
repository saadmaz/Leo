import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

# Resolve paths relative to this file's directory (backend/) so they work
# regardless of the CWD from which the server is launched.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_FILE = os.path.join(_BACKEND_DIR, ".env")
_DEFAULT_SA_PATH = os.path.join(_BACKEND_DIR, "firebase-service-account.json")


class Settings(BaseSettings):
    # --- LLM Providers ---
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    NVIDIA_NIM_API_KEY: Optional[str] = None

    # --- Web Scraping & Crawling ---
    FIRECRAWL_API_KEY: Optional[str] = None
    APIFY_API_KEY: Optional[str] = None

    # --- Social & Data APIs ---
    YOUTUBE_API_KEY: Optional[str] = None
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    META_ACCESS_TOKEN: Optional[str] = None
    LINKEDIN_CLIENT_ID: Optional[str] = None
    LINKEDIN_CLIENT_SECRET: Optional[str] = None
    TIKTOK_CLIENT_KEY: Optional[str] = None
    TIKTOK_CLIENT_SECRET: Optional[str] = None
    X_BEARER_TOKEN: Optional[str] = None
    X_CLIENT_ID: Optional[str] = None
    X_CLIENT_SECRET: Optional[str] = None

    # --- Brand Intelligence ---
    LOGO_DEV_API_KEY: Optional[str] = None

    # --- Storage (Cloudflare R2) ---
    CLOUDFLARE_R2_TOKEN: Optional[str] = None
    CLOUDFLARE_ACCOUNT_ID: Optional[str] = None
    CLOUDFLARE_R2_ACCESS_KEY_ID: Optional[str] = None
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: Optional[str] = None
    CLOUDFLARE_R2_BUCKET_NAME: Optional[str] = None
    CLOUDFLARE_R2_ENDPOINT: Optional[str] = None

    # --- Email ---
    RESEND_API_KEY: Optional[str] = None

    # --- Payments ---
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_METER_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRO_PRICE_ID: Optional[str] = None
    STRIPE_AGENCY_PRICE_ID: Optional[str] = None

    # --- Firebase ---
    FIREBASE_PROJECT_ID: Optional[str] = None
    # Absolute path to the service account JSON — set via env var to override.
    FIREBASE_SERVICE_ACCOUNT_PATH: str = _DEFAULT_SA_PATH
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None

    # --- App Config ---
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        # Absolute path — works regardless of launch CWD.
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
