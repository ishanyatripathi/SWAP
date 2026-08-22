"""
SQLAlchemy engine/session setup.

This is the single place that knows how to connect to the database.
Every model and route imports `Base` and `get_db` from here — nothing
else touches `create_engine` directly, which is what makes swapping
SQLite -> Postgres later a config-only change.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

# `check_same_thread` is only needed for SQLite. It's a no-op / ignored
# on Postgres, so this line does not need to change when you migrate.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
