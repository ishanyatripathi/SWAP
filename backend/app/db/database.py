"""
SQLAlchemy engine/session setup.

This is the single place that knows how to connect to the database.
Every model and route imports `Base` and `get_db` from here — nothing
else touches `create_engine` directly, which is what makes swapping
SQLite -> Postgres later a config-only change.
"""
import sqlite3
from pathlib import Path

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


def ensure_sqlite_schema(db_path: str | None = None) -> None:
    """Repair older SQLite databases that predate the teacher metadata columns."""
    if engine.url.get_backend_name() != "sqlite":
        return

    target = db_path or engine.url.database
    if not target or target == ":memory:":
        return

    resolved = Path(target)
    if not resolved.is_absolute():
        resolved = (Path.cwd() / resolved).resolve()

    if not resolved.exists():
        return

    conn = sqlite3.connect(resolved)
    try:
        table_exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='teachers'"
        ).fetchone()
        if not table_exists:
            return

        columns = {
            row[1]
            for row in conn.execute("PRAGMA table_info(teachers)").fetchall()
        }
        required = ["full_name", "subject", "phone", "email"]
        for column in required:
            if column not in columns:
                conn.execute(f"ALTER TABLE teachers ADD COLUMN {column} TEXT")

        conn.commit()
    finally:
        conn.close()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
