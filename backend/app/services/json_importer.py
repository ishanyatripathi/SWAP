"""
JSON Timetable Importer service for S.W.A.P.
Loads master timetable from teacher_timetables.json directly into SQLite.
"""
import json
import os
import re
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ICSE unified period grid — the school's primary reference
ICSE_PERIODS = {
    1:  ("08:15", "09:15"),   # expanded to absorb ISC P1 (08:15-08:45)
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
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)

def _clock_to_icse_periods(start_hhmm: str, end_hhmm: str) -> list[int]:
    slot_start = _to_minutes(start_hhmm)
    slot_end   = _to_minutes(end_hhmm)
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

    if atype == "special":
        return (f"Duty:SP:{teacher_id}", assignment[:40])

    if atype == "zero_period":
        m = re.match(r'^(\d+[A-Za-z/]+)', assignment.strip())
        class_name = m.group(1) if m else f"Duty:ZP:{teacher_id}"
        return (class_name, "Zero Period")

    m = re.match(r'^(\d+[A-Za-z/]+)\s*\(([^)]+)\)', assignment.strip())
    if m:
        class_name = m.group(1)
        subject_raw = m.group(2)
        subject = subject_raw.split()[0]
        return (class_name, subject)

    return (f"Unknown:{teacher_id}", assignment[:40])

def sync_master_json_timetable(db_path: str = None, json_path: str = None) -> dict:
    if not db_path:
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "classcover.db")
    if not json_path:
        # Check standard project locations
        project_root = Path(__file__).resolve().parents[3]
        candidate = project_root / "Timetables" / "teacher_timetables.json"
        if candidate.is_file():
            json_path = str(candidate)
        else:
            json_path = r"C:\Users\ishan\Desktop\SWAP\Timetables\teacher_timetables.json"

    if not os.path.exists(json_path):
        logger.warning(f"Master timetable JSON not found at {json_path}")
        return {"status": "error", "message": f"File not found: {json_path}"}

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    teachers_json = data.get("teachers", [])
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    # Clean junk
    for junk in ("TEST", "ll", "PEG"):
        cur.execute("DELETE FROM timetable_slots WHERE teacher_id = (SELECT id FROM teachers WHERE name = ?)", (junk,))
        cur.execute("DELETE FROM teachers WHERE name = ?", (junk,))

    # Sync teachers
    teacher_id_map = {}
    for tj in teachers_json:
        tid = tj["teacher_id"]
        tname = tj["teacher_name"]
        full_name_match = re.match(r'^(.+?)\s*\(' + re.escape(tid) + r'\)$', tname)
        full_name = full_name_match.group(1).strip() if full_name_match else tname

        cur.execute("SELECT id FROM teachers WHERE name = ?", (tid,))
        row = cur.fetchone()
        if row:
            db_id = row[0]
            cur.execute("UPDATE teachers SET full_name = ?, is_active = 1 WHERE id = ?", (full_name, db_id))
        else:
            cur.execute("INSERT INTO teachers (name, full_name, is_active) VALUES (?, ?, 1)", (tid, full_name))
            db_id = cur.lastrowid
        teacher_id_map[tid] = db_id

    # Deactivate any teacher not in JSON
    all_json_initials = {tj["teacher_id"] for tj in teachers_json}
    cur.execute("SELECT id, name FROM teachers")
    for db_id, db_name in cur.fetchall():
        if db_name not in all_json_initials:
            cur.execute("UPDATE teachers SET is_active = 0 WHERE id = ?", (db_id,))

    # Clear timetable_slots
    cur.execute("DELETE FROM timetable_slots")

    class_cache: dict[str, int] = {}
    def get_class_id(class_name: str) -> int:
        if class_name in class_cache:
            return class_cache[class_name]
        cur.execute("SELECT id FROM classes WHERE name = ?", (class_name,))
        row = cur.fetchone()
        if row:
            class_cache[class_name] = row[0]
        else:
            cur.execute("INSERT INTO classes (name) VALUES (?)", (class_name,))
            class_cache[class_name] = cur.lastrowid
        return class_cache[class_name]

    inserted = 0
    for tj in teachers_json:
        tid = tj["teacher_id"]
        db_tid = teacher_id_map.get(tid)
        if not db_tid:
            continue

        for day_sched in tj.get("weekly_schedule", []):
            day = day_sched["day"].upper()
            for assignment in day_sched.get("assignments", []):
                atype = assignment.get("type", "real_class")
                if atype == "free":
                    continue
                start = assignment.get("start", "")
                end = assignment.get("end", "")
                assign = assignment.get("assignment", "")
                periods = _clock_to_icse_periods(start, end)
                if not periods:
                    continue

                class_name, subject = _extract_class_and_subject(assign, atype, tid)
                class_db_id = get_class_id(class_name)

                for period in periods:
                    try:
                        cur.execute(
                            """
                            INSERT INTO timetable_slots (day, period, subject, room, teacher_id, class_id)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (day, period, subject, None, db_tid, class_db_id)
                        )
                        inserted += 1
                    except sqlite3.IntegrityError:
                        pass

    conn.commit()
    conn.close()
    logger.info(f"Successfully synced master JSON timetable: {inserted} slots imported across {len(teacher_id_map)} teachers.")
    return {"status": "success", "inserted_slots": inserted, "total_teachers": len(teacher_id_map)}
