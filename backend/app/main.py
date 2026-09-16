"""
ClassCover API entrypoint.

Run with:  uvicorn app.main:app --reload
Docs at:   http://127.0.0.1:8000/docs
"""
import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.db.database import Base, engine
from app.api.router import api_router

# Import models so SQLAlchemy's metadata knows about every table
# before create_all() runs.
from app.models import school, teacher, timetable, substitution  # noqa: F401

logger = logging.getLogger(__name__)

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


application_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
frontend_dist = application_root / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    logger.warning("Frontend build not found at %s; run npm run build in frontend/", frontend_dist)
