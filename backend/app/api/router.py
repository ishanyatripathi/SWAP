"""Aggregates all versioned route modules under a single /api/v1 prefix."""
from fastapi import APIRouter

from app.api.routes import teachers, settings, upload, substitutions

api_router = APIRouter()
api_router.include_router(teachers.router)
api_router.include_router(settings.router)
api_router.include_router(upload.router)
api_router.include_router(substitutions.router)
