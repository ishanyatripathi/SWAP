"""School settings — single row (id=1) for the MVP. See models/school.py."""
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.school import School
from app.models.teacher import Teacher, SchoolClass
from app.models.timetable import TimetableSlot, TimetableUpload
from app.models.substitution import SubstitutionEntry, SubstitutionRun
from app.schemas.settings import SchoolSettingsOut, SchoolSettingsUpdate
from app.core.config import get_settings

router = APIRouter(prefix="/settings", tags=["settings"])
settings = get_settings()


def _get_or_create(db: Session) -> School:
    school = db.query(School).filter(School.id == 1).first()
    if not school:
        school = School(id=1)
        db.add(school)
        db.commit()
        db.refresh(school)
    return school


@router.get("", response_model=SchoolSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=SchoolSettingsOut)
def update_settings(payload: SchoolSettingsUpdate, db: Session = Depends(get_db)):
    school = _get_or_create(db)
    data = payload.model_dump(exclude_unset=True)
    if "period_timings" in data and data["period_timings"] is not None:
        data["period_timings"] = [pt if isinstance(pt, dict) else pt.model_dump() for pt in data["period_timings"]]
    for field, value in data.items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return school


@router.post("/reset", status_code=204)
def reset_application(db: Session = Depends(get_db)):
    db.query(SubstitutionEntry).delete()
    db.query(SubstitutionRun).delete()
    db.query(TimetableSlot).delete()
    db.query(TimetableUpload).delete()
    db.query(Teacher).delete()
    db.query(SchoolClass).delete()
    db.query(School).delete()
    db.commit()

    if os.path.isdir(settings.UPLOAD_DIR):
        for entry in os.listdir(settings.UPLOAD_DIR):
            path = os.path.join(settings.UPLOAD_DIR, entry)
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)

    backups_dir = Path(__file__).resolve().parents[3] / "backups"
    if backups_dir.is_dir():
        shutil.rmtree(backups_dir)
