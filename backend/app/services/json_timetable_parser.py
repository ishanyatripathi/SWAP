import json
import re
from pathlib import Path


class TimetableParseError(ValueError):
    """Raised when a JSON timetable file cannot be interpreted."""


_EXCLUDED_ASSIGNMENT_TYPES = {
    "zero_period",
    "faculty_meeting",
    "library_duty",
    "special_activity",
    "free",
    "break",
    "assembly",
}


def _extract_room(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"\{\s*room\s*:\s*([^}]+)\}", value, flags=re.IGNORECASE)
    if not match:
        return None
    room = match.group(1).strip().strip('"').strip("'")
    return room or None


def _extract_class_and_subject(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    match = re.search(r"(?P<class>[A-Za-z0-9/]+)\s*\((?P<subject>[^)]+)\)", value)
    if match:
        class_name = match.group("class").strip()
        subject = match.group("subject").strip()
        return class_name or None, subject or None

    # Fallback for entries that keep the class name before a subject-like label.
    fallback = re.search(r"(?P<class>[A-Za-z0-9/]+)\s*(?:-|:|\s+)(?P<subject>[A-Za-z0-9 /]+)", value)
    if fallback:
        return fallback.group("class").strip(), fallback.group("subject").strip()

    return None, None


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
        teacher_entries = payload.get("teachers")
    else:
        teacher_entries = payload

    if not isinstance(teacher_entries, list):
        raise TimetableParseError("The JSON file must contain a 'teachers' array.")

    rows: list[dict] = []
    for teacher_entry in teacher_entries:
        if not isinstance(teacher_entry, dict):
            continue

        teacher_id = teacher_entry.get("teacher_id")
        if not teacher_id:
            teacher_name = teacher_entry.get("teacher_name") or ""
            match = re.search(r"\(([^)]+)\)", teacher_name)
            teacher_id = match.group(1) if match else teacher_name.strip()

        if "weekly_schedule" in teacher_entry:
            daily_entries = teacher_entry.get("weekly_schedule") or []
        elif "day" in teacher_entry and "assignments" in teacher_entry:
            daily_entries = [teacher_entry]
        else:
            daily_entries = []

        for daily_entry in daily_entries:
            if not isinstance(daily_entry, dict):
                continue

            day = daily_entry.get("day")
            assignments = daily_entry.get("assignments") or []
            if not day or not isinstance(assignments, list):
                continue

            for assignment in assignments:
                if not isinstance(assignment, dict):
                    continue

                assignment_type = (assignment.get("type") or "").strip().lower()
                if assignment_type in _EXCLUDED_ASSIGNMENT_TYPES:
                    continue

                source_period = assignment.get("source_period")
                if source_period is None:
                    source_period = assignment.get("period")
                if source_period is None:
                    continue

                assignment_text = assignment.get("assignment") or ""
                class_name, subject = _extract_class_and_subject(assignment_text)
                if not class_name or not subject:
                    continue

                rows.append(
                    {
                        "day": str(day).upper(),
                        "period": int(source_period),
                        "teacher": str(teacher_id),
                        "class_name": class_name,
                        "subject": subject,
                        "room": _extract_room(assignment_text),
                    }
                )

    if not rows:
        raise TimetableParseError("No valid class rows were found in the JSON timetable.")

    return rows
