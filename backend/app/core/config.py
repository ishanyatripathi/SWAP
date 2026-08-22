"""
Central application configuration.

Everything environment-specific (database URL, upload paths, CORS origins)
lives here so the rest of the codebase never hardcodes it. Swapping SQLite
for Postgres later is a one-line change to DATABASE_URL — no other code
in the app needs to change because all DB access goes through SQLAlchemy.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ClassCover API"
    API_V1_PREFIX: str = "/api/v1"

    # SQLite for the MVP. To move to Postgres later, set:
    # DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/classcover
    DATABASE_URL: str = "sqlite:///./classcover.db"

    UPLOAD_DIR: str = "./uploads"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
