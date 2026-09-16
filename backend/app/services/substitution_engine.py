"""
The substitution engine — deliberately simple and deterministic.

No AI, no scoring, no workload balancing, as specified. Two entry points:

  preview_substitutions()   -- for every lecture an absent teacher was
                                scheduled to teach, return EVERY teacher
                                free at that period (not just one), plus
                                a suggested default (first free teacher).
                                Nothing is persisted. This is what powers
                                the "let the coordinator manually pick"
                                workflow: the first free teacher is only
                                a suggestion, since a "free" teacher may
                                have other duties the timetable doesn't
                                capture.

  free_teachers_for_period() -- the underlying lookup, exposed separately
                                so a single lecture's options can be
                                recomputed on demand if needed.

Because the whole day's timetable is loaded once into an in-memory map,
computing previews for N absent teachers is a single pass over the day's
rows, not N repeated DB round-trips.
"""
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.models.timetable import TimetableSlot
from app.models.teacher import Teacher


@dataclass
class SubstitutionResult:
    period: int
    class_name: str
    subject: str | None
    room: str | None
    absent_teacher: str
    substitute_teacher: str | None
    status: str  # "Assigned" | "Unassigned"


@dataclass
class CoverageOption:
    """A single lecture that needs a substitute, with every free candidate."""
    period: int
    class_name: str
    subject: str | None
    room: str | None
    absent_teacher: str
    free_teachers: list[str] = field(default_factory=list)
    suggested_substitute: str | None = None  # first free teacher, a default only


def _load_day(db: Session, day: str):
    day_slots: list[TimetableSlot] = db.query(TimetableSlot).filter(TimetableSlot.day == day).all()
    all_teachers: list[Teacher] = (
        db.query(Teacher).filter(Teacher.is_active.is_(True)).order_by(Teacher.name).all()
    )
    busy_by_period: dict[int, set[int]] = {}
    for slot in day_slots:
        busy_by_period.setdefault(slot.period, set()).add(slot.teacher_id)
    return day_slots, all_teachers, busy_by_period


def preview_substitutions(
    db: Session,
    day: str,
    absent_teacher_names: list[str],
) -> list[CoverageOption]:
    """
    For every lecture taught by an absent teacher, list every teacher who
    is free that period (i.e. not already teaching, and not themselves
    absent). Does not assign or persist anything — the coordinator picks
    the final substitute from these options.
    """
    day_slots, all_teachers, busy_by_period = _load_day(db, day)
    absent_set = set(absent_teacher_names)
    assignments_by_teacher: dict[str, int] = {}
    suggested_by_period: dict[int, set[str]] = {}

    options: list[CoverageOption] = []
    for slot in sorted(day_slots, key=lambda s: s.period):
        if slot.teacher.name not in absent_set:
            continue

        busy_teacher_ids = busy_by_period.get(slot.period, set())
        free = [
            t.name for t in all_teachers
            if t.id != slot.teacher_id and t.name not in absent_set and t.id not in busy_teacher_ids
        ]
        reserved = suggested_by_period.setdefault(slot.period, set())
        balanced_free = [
            name for name in free
            if name not in reserved and assignments_by_teacher.get(name, 0) < 2
        ]
        available_free = [name for name in free if name not in reserved]
        suggested = min(
            balanced_free or available_free,
            key=lambda name: (assignments_by_teacher.get(name, 0), name),
            default=None,
        )
        if suggested:
            assignments_by_teacher[suggested] = assignments_by_teacher.get(suggested, 0) + 1
            reserved.add(suggested)

        options.append(CoverageOption(
            period=slot.period,
            class_name=slot.school_class.name,
            subject=slot.subject,
            room=slot.room,
            absent_teacher=f"{slot.teacher.full_name} ({slot.teacher.name})" if slot.teacher.full_name else slot.teacher.name,
            free_teachers=[
                f"{next(t.full_name for t in all_teachers if t.name == name)} ({name})"
                if next((t.full_name for t in all_teachers if t.name == name), None) else name
                for name in free
            ],
            suggested_substitute=(
                f"{next(t.full_name for t in all_teachers if t.name == suggested)} ({suggested})"
                if next((t.full_name for t in all_teachers if t.name == suggested), None) else suggested
            ) if suggested else None,
        ))

    return options


def generate_substitutions(
    db: Session,
    day: str,
    absent_teacher_names: list[str],
) -> list[SubstitutionResult]:
    """
    Fully automatic version (kept for cases where no manual review is
    wanted): same "first free teacher" rule as preview_substitutions,
    but commits to the suggested pick immediately and reserves that
    substitute so two absent teachers' lectures in the same period never
    get double-booked onto the same person.
    """
    day_slots, all_teachers, busy_by_period = _load_day(db, day)
    absent_set = set(absent_teacher_names)
    assignments_by_teacher: dict[str, int] = {}
    results: list[SubstitutionResult] = []

    for slot in sorted(day_slots, key=lambda s: s.period):
        if slot.teacher.name not in absent_set:
            continue

        busy_teacher_ids = busy_by_period.get(slot.period, set())
        substitute = None
        candidates = [
            candidate for candidate in all_teachers
            if candidate.name not in absent_set
            and candidate.id != slot.teacher_id
            and candidate.id not in busy_teacher_ids
        ]
        candidates.sort(key=lambda candidate: (assignments_by_teacher.get(candidate.name, 0), candidate.name))
        for candidate in candidates:
            if assignments_by_teacher.get(candidate.name, 0) >= 2:
                continue
            substitute = candidate
            break

        results.append(SubstitutionResult(
            period=slot.period,
            class_name=slot.school_class.name,
            subject=slot.subject,
            room=slot.room,
            absent_teacher=f"{slot.teacher.full_name} ({slot.teacher.name})" if slot.teacher.full_name else slot.teacher.name,
            substitute_teacher=(
                f"{substitute.full_name} ({substitute.name})" if substitute.full_name else substitute.name
            ) if substitute else None,
            status="Assigned" if substitute else "Unassigned",
        ))

        if substitute:
            busy_by_period.setdefault(slot.period, set()).add(substitute.id)
            assignments_by_teacher[substitute.name] = assignments_by_teacher.get(substitute.name, 0) + 1

    return results
