from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app configuration, populated from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://darukaa:darukaa@localhost:5432/darukaa"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — must include the deployed frontend origin in production.
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # GenAI provider configuration. "fallback" is a fully local, grounded provider, so the
    # product is demoable with no paid credentials at all.
    LLM_PROVIDER: str = "fallback"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Autonomous monitoring agent
    AGENT_ENABLED: bool = True
    AGENT_INTERVAL_SECONDS: int = 900


settings = Settings()
