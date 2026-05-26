from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Auth - JWT_SECRET is required; app fails to start if not provided
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Storage
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    upload_dir: str = "./data/uploads"
    chroma_dir: str = "./data/chroma"

    # LLM provider: "gemini" or "openai"
    llm_provider: str = "gemini"
    google_api_key: str | None = None
    openai_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    openai_model: str = "gpt-4o-mini"
    embedding_model_gemini: str = "models/text-embedding-004"
    embedding_model_openai: str = "text-embedding-3-small"

    # CORS
    cors_origins: str = "*"


settings = Settings()
