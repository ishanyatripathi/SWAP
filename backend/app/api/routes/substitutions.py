"""
The core daily workflow: preview coverage options, let the coordinator
choose (which may differ from the suggested default), then confirm to
persist the final substitution timetable. A fully-automatic /generate
endpoint is kept for cases where no manual review is needed.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.substitution import SubstitutionRun, SubstitutionEntry
from app.models.school import School
from app.models.teacher import Teacher
from app.schemas.substitution import (
    PreviewRequest,
    CoverageOptionOut,
    ConfirmRequest,
    GenerateSubstitutionRequest,
    SubstitutionRunOut,
)
from app.services.substitution_engine import preview_substitutions, generate_substitutions

router = APIRouter(prefix="/substitutions", tags=["substitutions"])

_WEEKDAY_TO_CODE = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def _day_code(date_str: str) -> str:
    return _WEEKDAY_TO_CODE[datetime.fromisoformat(date_str).weekday()]


def _period_time_label(db: Session, period: int) -> str | None:
    school = db.query(School).filter(School.id == 1).first()
    if not school or not school.period_timings:
        return None
    for pt in school.period_timings:
        if pt.get("period") == period:
            return f"{pt.get('start')}\u2013{pt.get('end')}"
    return None


@router.post("/preview", response_model=list[CoverageOptionOut])
def preview(payload: PreviewRequest, db: Session = Depends(get_db)):
    """
    Returns every lecture needing coverage, each with the full list of
    free teachers at that period — nothing is saved yet. The frontend
    renders one dropdown per lecture, pre-filled with `suggested_substitute`
    but fully overridable by the coordinator.
    """
    options = preview_substitutions(db, _day_code(payload.date), payload.absent_teacher_names)
    return [
        CoverageOptionOut(
            period=o.period,
            time_slot=_period_time_label(db, o.period),
            class_name=o.class_name,
            subject=o.subject,
            room=o.room,
            absent_teacher=o.absent_teacher,
            free_teachers=o.free_teachers,
            suggested_substitute=o.suggested_substitute,
        )
        for o in options
    ]


@router.post("/confirm", response_model=SubstitutionRunOut)
def confirm(payload: ConfirmRequest, db: Session = Depends(get_db)):
    """Persists the coordinator's final (possibly manually overridden) choices."""
    teacher_map = {
        t.name: f"{t.full_name} ({t.name})" if t.full_name else t.name
        for t in db.query(Teacher).all()
    }
    formatted_absent = [teacher_map.get(name, name) for name in payload.absent_teacher_names]

    run = SubstitutionRun(
        date=payload.date,
        absent_teacher_names=formatted_absent,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(run)
    db.flush()

    for e in payload.entries:
        db.add(SubstitutionEntry(
            run_id=run.id,
            period=e.period,
            time_slot=_period_time_label(db, e.period),
            class_name=e.class_name,
            subject=e.subject,
            room=e.room,
            absent_teacher=e.absent_teacher,
            substitute_teacher=e.substitute_teacher,
            status="Assigned" if e.substitute_teacher else "Unassigned",
        ))

    db.commit()
    db.refresh(run)
    return run


@router.post("/generate", response_model=SubstitutionRunOut)
def generate(payload: GenerateSubstitutionRequest, db: Session = Depends(get_db)):
    """Fully automatic: picks the first free teacher for every lecture and saves immediately."""
    teacher_map = {
        t.name: f"{t.full_name} ({t.name})" if t.full_name else t.name
        for t in db.query(Teacher).all()
    }
    formatted_absent = [teacher_map.get(name, name) for name in payload.absent_teacher_names]

    results = generate_substitutions(db, _day_code(payload.date), payload.absent_teacher_names)

    run = SubstitutionRun(
        date=payload.date,
        absent_teacher_names=formatted_absent,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(run)
    db.flush()

    for r in results:
        db.add(SubstitutionEntry(
            run_id=run.id,
            period=r.period,
            time_slot=_period_time_label(db, r.period),
            class_name=r.class_name,
            subject=r.subject,
            room=r.room,
            absent_teacher=r.absent_teacher,
            substitute_teacher=r.substitute_teacher,
            status=r.status,
        ))

    db.commit()
    db.refresh(run)
    return run


@router.get("", response_model=list[SubstitutionRunOut])
def list_runs(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(SubstitutionRun).options(joinedload(SubstitutionRun.entries))
    if date_from:
        q = q.filter(SubstitutionRun.date >= date_from)
    if date_to:
        q = q.filter(SubstitutionRun.date <= date_to)
    return q.order_by(SubstitutionRun.date.desc()).all()


@router.get("/{run_id}", response_model=SubstitutionRunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SubstitutionRun)
        .options(joinedload(SubstitutionRun.entries))
        .filter(SubstitutionRun.id == run_id)
        .first()
    )
