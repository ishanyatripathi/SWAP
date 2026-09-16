"""
JSON Timetable Parser for S.W.A.P.
Reads structured teacher timetables JSON and extracts unified timetable slots.
"""
import json
import re
from pathlib import Path


class TimetableParseError(ValueError):
    """Raised when a JSON timetable file cannot be interpreted."""


# Unified ICSE period grid (Clock times for Periods 1 to 12)
ICSE_PERIODS = {
    1:  ("08:15", "09:15"),   # Covers ISC P1 (08:15-08:45) and ICSE P1 (08:45-09:15)
    2:  ("09:15", "09:45"),
    3:  ("10:00", "10:30"),
    4:  ("10:30", "11:00"),
    5:  ("11:00", "11:30"),
    6:  ("11:30", "12:00"),
    7:  ("12:00", "12:30"),
    8:  ("13:05", "13:35"),
    9:  ("13:35", "14:05"),
    10: ("14:05", "14:35"),
    11: ("14:45", "15:15"),
    12: ("15:15", "15:45"),
}

def _to_minutes(hhmm: str) -> int:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 0

def _clock_to_icse_periods(start_hhmm: str, end_hhmm: str) -> list[int]:
    slot_start = _to_minutes(start_hhmm)
    slot_end   = _to_minutes(end_hhmm)
    if slot_start >= slot_end:
        return []
    matched = []
    for period, (ps, pe) in ICSE_PERIODS.items():
        period_start = _to_minutes(ps)
        period_end   = _to_minutes(pe)
        if period_start < slot_end and period_end > slot_start:
            matched.append(period)
    return matched

def _extract_class_and_subject(assignment: str, atype: str, teacher_id: str) -> tuple[str, str]:
    if atype == "faculty_meeting":
        m = re.search(r'\(([^)]+)\)', assignment)
        subj = m.group(1).split()[0] if m else "FM"
        return (f"Duty:FM:{teacher_id}", "Faculty Meeting")

    if atype == "library_duty":
        return (f"Duty:LIB:{teacher_id}", "Library Duty")

    if atype in ("special", "special_activity"):
        return (f"Duty:SP:{teacher_id}", assignment[:40] if assignment else "Special Duty")

    if atype == "zero_period":
        m = re.match(r'^(\d+[A-Za-z/]+)', assignment.strip())
        class_name = m.group(1) if m else f"Duty:ZP:{teacher_id}"
        return (class_name, "Zero Period")

    # Real classes
    m = re.match(r'^(\d+[A-Za-z/]+)\s*\(([^)]+)\)', assignment.strip())
    if m:
        class_name = m.group(1)
        subject_raw = m.group(2)
        subject = subject_raw.split()[0]
        return (class_name, subject)

    return (f"Unknown:{teacher_id}", assignment[:40] if assignment else "Class")

def _extract_room(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"\{\s*room\s*:\s*([^}]+)\}", value, flags=re.IGNORECASE)
    if not match:
        return None
    room = match.group(1).strip().strip('"').strip("'")
    return room or None


def parse_json_timetable(file_path: str) -> list[dict]:
    """Read a JSON timetable export and normalize it into timetable rows."""
    path = Path(file_path)
    if not path.exists():
        raise TimetableParseError(f"Timetable JSON not found: {file_path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise TimetableParseError(f"File is not valid JSON: {exc.msg}") from exc

    if isinstance(payload, dict):
        teacher_entries = payload.get("teachers", [])
    else:
        teacher_entries = payload

    if not isinstance(teacher_entries, list):
        raise TimetableParseError("The JSON file must contain a 'teachers' array.")

    rows: list[dict] = []
    seen_slots = set()

    for teacher_entry in teacher_entries:
        if not isinstance(teacher_entry, dict):
            continue

        teacher_id = teacher_entry.get("teacher_id")
        if not teacher_id:
            teacher_name = teacher_entry.get("teacher_name") or ""
            match = re.search(r"\(([^)]+)\)", teacher_name)
            teacher_id = match.group(1) if match else teacher_name.strip()

        daily_entries = teacher_entry.get("weekly_schedule", [])

        for daily_entry in daily_entries:
            if not isinstance(daily_entry, dict):
                continue

            day = (daily_entry.get("day") or "").upper()
            assignments = daily_entry.get("assignments", [])

            for assignment in assignments:
                if not isinstance(assignment, dict):
                    continue

                atype = (assignment.get("type") or "real_class").strip().lower()
                if atype in ("free", "break", "prayer", "assembly"):
                    continue

                start = assignment.get("start", "")
                end = assignment.get("end", "")
                assign_text = assignment.get("assignment", "")
                room = _extract_room(assign_text)

                periods = _clock_to_icse_periods(start, end)
                if not periods:
                    # Fallback to source_period if clock time missing
                    sp = assignment.get("source_period") or assignment.get("period")
                    if sp is not None:
                        periods = [int(sp)]

                class_name, subject = _extract_class_and_subject(assign_text, atype, teacher_id)

                for p in periods:
                    slot_key = (day, p, str(teacher_id), class_name)
                    if slot_key in seen_slots:
                        continue
                    seen_slots.add(slot_key)

                    rows.append({
                        "day": day,
                        "period": p,
                        "teacher": str(teacher_id),
                        "class_name": class_name,
                        "subject": subject,
                        "room": room,
                    })

    if not rows:
        raise TimetableParseError("No valid timetable rows were found in the JSON timetable.")

    return rows
