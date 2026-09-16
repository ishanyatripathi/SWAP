"""
Teacher Availability endpoint.

Returns, for a given day of the week, a full picture of which teachers
are free in which periods — both in teacher-wise form (each teacher's
free-period list) and in period-wise form (each period's list of free
teachers). Reuses the same timetable data as the substitution engine;
no separate data source is required.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.school import School
from app.models.timetable import TimetableSlot
from app.models.teacher import Teacher
from app.schemas.availability import (
    AvailabilityResponse,
    FreePeriodOut,
    PeriodFreeTeacherOut,
    TeacherAvailabilityOut,
)

router = APIRouter(prefix="/availability", tags=["availability"])

VALID_DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}


from datetime import datetime

def _format_time(hh_mm: str) -> str:
    try:
        t = datetime.strptime(hh_mm, "%H:%M")
        return t.strftime("%I:%M %p").lstrip("0")
    except ValueError:
        return hh_mm

def _period_time_label(period_timings: list, period: int) -> str | None:
    """Return 'HH:MM AM–HH:MM PM' for the given period number, or None."""
    for pt in period_timings:
        if pt.get("period") == period:
            start = _format_time(pt.get("start", ""))
            end = _format_time(pt.get("end", ""))
            if start and end:
                return f"{start} – {end}"
            elif start or end:
                return start or end
    return None


@router.get("", response_model=AvailabilityResponse)
def get_availability(
    day: str = Query(..., description="Day code: MON, TUE, WED, THU, FRI, SAT, SUN"),
    db: Session = Depends(get_db),
):
    """
    For the requested weekday, return:
      - teacher_wise: each active teacher with their list of free periods and total count.
      - period_wise:  each period with the names of teachers who are free.

    KEY LOGIC:
      - The canonical set of periods for a day is derived directly from the
        timetable_slots rows for that day. This is intentional: school settings
        (periods_per_day) may be misconfigured or may not match the uploaded
        timetable. Using the actual slot data guarantees correctness.
      - A teacher is "busy" in a period if they have at least one TimetableSlot
        for that (day, period). They are "free" if that period exists in the
        day's schedule but they have no slot in it.
      - Teachers who appear in the teachers table but have no timetable data at
        all for this day are excluded from the availability output, as their
        schedule is unknown and showing them as "100% free" would be misleading.
    """
    day = day.upper()

    # ── School settings (for time labels only) ────────────────────────
    school = db.query(School).filter(School.id == 1).first()
    period_timings: list = school.period_timings if school and school.period_timings else []

    # ── Load all slots for this day ───────────────────────────────────
    day_slots: list[TimetableSlot] = (
        db.query(TimetableSlot).filter(TimetableSlot.day == day).all()
    )

    # The canonical period list = every distinct period that actually appears
    # in the timetable for this day. This is always correct regardless of
    # what the school settings say about periods_per_day.
    all_periods: list[int] = sorted({s.period for s in day_slots})

    if not all_periods:
        # No timetable data for this day at all — return empty response.
        return AvailabilityResponse(day=day, teacher_wise=[], period_wise=[])

    # Build a set of (teacher_id, period) pairs that are "busy" on this day.
    busy: set[tuple[int, int]] = {(s.teacher_id, s.period) for s in day_slots}

    # The set of teacher IDs that appear at least once in the day's timetable.
    # Teachers absent from the timetable entirely have unknown schedules and
    # are excluded rather than shown as free in every period.
    teachers_in_timetable: set[int] = {s.teacher_id for s in day_slots}

    # ── Active teachers who appear in this day's timetable ────────────
    teachers: list[Teacher] = (
        db.query(Teacher)
        .filter(
            Teacher.is_active.is_(True),
            Teacher.id.in_(teachers_in_timetable),
        )
        .order_by(Teacher.name)
        .all()
    )

    # ── Build teacher-wise view ───────────────────────────────────────
    teacher_wise: list[TeacherAvailabilityOut] = []
    for teacher in teachers:
        free_periods = [
            FreePeriodOut(
                period=p,
                time_slot=_period_time_label(period_timings, p),
            )
            for p in all_periods
            if (teacher.id, p) not in busy
        ]
        teacher_wise.append(
            TeacherAvailabilityOut(
                teacher_name=f"{teacher.full_name} ({teacher.name})" if teacher.full_name else teacher.name,
                free_periods=free_periods,
                total_free_periods=len(free_periods),
            )
        )

    # ── Build period-wise view ────────────────────────────────────────
    period_wise: list[PeriodFreeTeacherOut] = []
    for p in all_periods:
        free_teachers = [
            f"{t.full_name} ({t.name})" if t.full_name else t.name
            for t in teachers if (t.id, p) not in busy
        ]
        period_wise.append(
            PeriodFreeTeacherOut(
                period=p,
                time_slot=_period_time_label(period_timings, p),
                free_teachers=free_teachers,
                total_free=len(free_teachers),
            )
        )

    return AvailabilityResponse(
        day=day,
        teacher_wise=teacher_wise,
        period_wise=period_wise,
    )
