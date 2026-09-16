"""
PDF timetable parser.

Two timetable PDFs are supported on first-time setup:
  - "class" timetable: a grid per class, rows/columns = periods vs days
  - "faculty" timetable: a grid per teacher, same shape

Both ultimately describe the same underlying fact: "on day X, period Y,
teacher T teaches subject S to class C [in room R]". So both parsers
normalize into the same list of dicts and get written into the single
`TimetableSlot` table by the caller (see api/routes/upload.py).

Table extraction uses pdfplumber's built-in table detection. Real-world
school timetable PDFs vary a lot in layout, so this parser is intentionally
defensive: any row/cell it can't confidently parse is skipped rather than
crashing the whole import, and a summary of what succeeded/failed is
returned so the UI can show a clean, specific error instead of a stack trace.
"""
import re
from collections import Counter

import pdfplumber

DAY_ALIASES = {
    "MON": "MON", "MONDAY": "MON",
    "TUE": "TUE", "TUES": "TUE", "TUESDAY": "TUE",
    "WED": "WED", "WEDNESDAY": "WED",
    "THU": "THU", "THUR": "THU", "THURS": "THU", "THURSDAY": "THU",
    "FRI": "FRI", "FRIDAY": "FRI",
    "SAT": "SAT", "SATURDAY": "SAT",
}

# Matches cells like "Maths / Mr. Patel / R201" or "Maths - Mr. Patel"
CELL_PATTERN = re.compile(r"^(?P<subject>[^/\-]+)[/\-](?P<teacher>[^/\-]+)(?:[/\-](?P<room>[^/\-]+))?$")


class TimetableParseError(Exception):
    """Raised when a PDF has no detectable table structure at all."""


def _normalize_day(raw: str) -> str | None:
    return DAY_ALIASES.get(raw.strip().upper())


def _get_full_name_map() -> dict[str, str]:
    """Load full_name -> initial map from DB if available."""
    try:
        import sqlite3, os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "classcover.db")
        if not os.path.exists(db_path):
            return {}
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name, full_name FROM teachers WHERE full_name IS NOT NULL")
        mapping = {row[1].strip().upper(): row[0] for row in cur.fetchall() if row[1]}
        conn.close()
        return mapping
    except Exception:
        return {}


def _parse_cell(raw: str) -> dict | None:
    """Parse a single timetable cell into {subject, teacher, room}."""
    if not raw or not raw.strip() or raw.strip().upper() in {"-", "FREE", "--"}:
        return None
    match = CELL_PATTERN.match(raw.strip())
    if not match:
        # Fallback: treat the whole cell as the teacher/subject name so we
        # still capture something rather than silently dropping the lecture.
        return {"subject": raw.strip(), "teacher": raw.strip(), "room": None}
    return {
        "subject": match.group("subject").strip(),
        "teacher": match.group("teacher").strip(),
        "room": (match.group("room") or "").strip() or None,
    }


def _is_asc_table(table: list[list[str | None]]) -> bool:
    if len(table) < 3 or len(table[1]) < 2:
        return False
    has_period_header = any(
        lines and re.match(r"^\s*\d+\s*$", lines[0])
        for cell in table[1][1:]
        for lines in [(cell or "").splitlines()]
    )
    has_day_row = any(_normalize_day(row[0] or "") for row in table[2:] if row)
    return has_period_header and has_day_row


def _asc_class_names(lines: list[str]) -> list[str]:
    class_names: list[str] = []
    for line in lines:
        for class_name in re.findall(r"\b\d{1,2}[A-Z][A-Z0-9]*\b", line):
            if class_name not in class_names:
                class_names.append(class_name)
    return class_names


# Known room / location tokens that can appear glued to a teacher code
_ROOM_TOKENS = {"CLAB", "LAB", "LIB", "COMP"}

# Known subject / course / section tokens that MUST NEVER be treated as teacher codes
_SUBJECT_TOKENS = {
    "LIT", "LANG", "HIN", "SLHIN", "TLHIN", "MAR", "PHY", "BIO", "CHEM", "MATH",
    "HIST", "HISTORY", "GEOG", "ART", "MUS", "PHE", "EVST", "VED", "SUPW", "ALP",
    "SA", "ZP", "HCS", "SS", "FM", "SEC", "PRI", "CT", "PCB", "COCURRICLAR", "ACADEMICS",
    "FREE", "BREAK", "PRAYER"
}


def _asc_teacher_codes(lines: list[str], class_names: list[str]) -> list[str]:
    teacher_codes: list[str] = []
    for index, line in enumerate(lines):
        # Split on slashes for multi-teacher lines like "IC / CT / AF / AD"
        parts = [part.strip() for part in re.split(r"\s*/\s*", line)]
        cleaned_parts: list[str] = []
        for part in parts:
            if not part:
                continue
            # Handle "AD CLAB" -> teacher="AD", strip CLAB
            tokens = part.split()
            if len(tokens) == 2 and tokens[1].upper() in _ROOM_TOKENS:
                part_candidate = tokens[0].upper()
            elif len(tokens) == 1:
                part_candidate = tokens[0].upper()
            else:
                continue

            if part_candidate not in _SUBJECT_TOKENS:
                cleaned_parts.append(part_candidate)

        if not cleaned_parts or not all(re.fullmatch(r"[A-Z]{2,5}", p) for p in cleaned_parts):
            continue
        if len(cleaned_parts) == 1 and (index == 0 or not class_names):
            continue
        for teacher_code in cleaned_parts:
            if teacher_code not in teacher_codes:
                teacher_codes.append(teacher_code)
    return teacher_codes


def _parse_asc_cell(raw: str) -> dict | None:
    lines = [line.strip() for line in (raw or "").splitlines() if line.strip()]
    if not lines:
        return None

    lowered = " ".join(lines).lower()
    if any(marker in lowered for marker in {"prayer", "break", "reyar", "kaerb", "ylbmessa", "noitcaretnI".lower()}):
        return None

    class_names = _asc_class_names(lines)
    teacher_codes = _asc_teacher_codes(lines, class_names)
    subject = next(
        (line for line in lines if line not in class_names and line not in teacher_codes),
        None,
    )
    if not teacher_codes and not class_names and _asc_teacher_codes(lines, class_names):
        teacher_codes = _asc_teacher_codes(lines, class_names)
        subject = None
    if not teacher_codes:
        return None

    return {
        "subject": subject,
        "teacher_codes": teacher_codes,
        "class_names": class_names or ["Unknown Class"],
    }


def _asc_page_class_name(page_text: str) -> str | None:
    header = page_text.split("Timetable generated", 1)[0]
    candidates = re.findall(r"\b\d{1,2}[A-Z][A-Z0-9]*(?:/\d{1,2}[A-Z][A-Z0-9]*)*\b", header)
    return candidates[-1] if candidates else None


def _is_break_or_skip(raw: str) -> bool:
    """Return True if this cell is a break / prayer / assembly — not a teaching slot."""
    if not raw or not raw.strip():
        return True
    lowered = raw.lower()
    skip_markers = {"prayer", "break", "reyar", "kaerb", "ylbmessa",
                    "noitcaretni", "assembly", "interaction", "gnol", "trohs"}
    return any(marker in lowered for marker in skip_markers)


def _parse_asc_timetable(file_path: str, kind: str) -> list[dict]:
    rows_out: list[dict] = []
    full_name_to_initial = _get_full_name_map()

    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages:
            raise TimetableParseError("The PDF has no pages.")

        found_any_table = False
        for page in pdf.pages:
            page_cells: list[tuple[str, int, dict]] = []
            page_teacher_codes: list[str] = []
            page_class_name = _asc_page_class_name(page.extract_text() or "")

            found_tables = page.find_tables()

            for table_obj in found_tables:
                table = table_obj.extract()
                if not table or not _is_asc_table(table):
                    continue
                found_any_table = True

                # Build column -> period mapping from header row
                period_columns: dict[int, int] = {}
                for index, cell_text in enumerate(table[1]):
                    lines = (cell_text or "").splitlines()
                    if not lines:
                        continue
                    first_line = lines[0].strip()
                    match = re.fullmatch(r"(\d+)", first_line)
                    if match:
                        period_columns[index] = int(match.group(1))

                # Build period -> x-range mapping from header row's physical cells.
                # The header row is row index 1 in the table.
                # Physical cell index matches table column index 1:1.
                period_x_ranges: dict[int, tuple[float, float]] = {}
                if table_obj.cells and period_columns:
                    row_tops = sorted(set(round(c[1], 0) for c in table_obj.cells))
                    if len(row_tops) >= 2:
                        header_top = row_tops[1]
                        header_phys_cells = sorted(
                            [c for c in table_obj.cells if round(c[1], 0) == header_top],
                            key=lambda c: c[0]
                        )
                        for col_idx, period in period_columns.items():
                            if col_idx < len(header_phys_cells):
                                phys_cell = header_phys_cells[col_idx]
                                period_x_ranges[period] = (phys_cell[0], phys_cell[2])

                # Detect merged cells: map (row_idx, first_period) -> [period, ...]
                merged_periods_by_row: dict[tuple[int, int], list[int]] = {}
                if period_x_ranges and table_obj.cells:
                    row_tops = sorted(set(round(c[1], 0) for c in table_obj.cells))
                    # Only check data rows (skip header rows 0 and 1)
                    data_row_tops = row_tops[2:] if len(row_tops) > 2 else []
                    periods_sorted = sorted(period_x_ranges.keys())

                    for cell_bbox in table_obj.cells:
                        x0, top, x1, bottom = cell_bbox
                        top_rounded = round(top, 0)
                        if top_rounded not in data_row_tops:
                            continue

                        row_data_idx = data_row_tops.index(top_rounded)
                        # Which periods does this physical cell cover?
                        covered = []
                        for period in periods_sorted:
                            pcx0, pcx1 = period_x_ranges[period]
                            col_width = pcx1 - pcx0
                            overlap = min(x1, pcx1) - max(x0, pcx0)
                            if overlap > col_width * 0.3:
                                covered.append(period)

                        if len(covered) > 1:
                            first_period = covered[0]
                            merged_periods_by_row[(row_data_idx, first_period)] = covered

                # Now parse cells with merged-cell awareness
                data_row_index = 0
                for row in table[2:]:
                    if not row:
                        continue
                    day = _normalize_day(row[0] or "")
                    if not day:
                        continue
                    for column, period in period_columns.items():
                        if column >= len(row):
                            continue
                        raw_text = (row[column] or "").strip()
                        if _is_break_or_skip(raw_text):
                            continue

                        # Determine all periods this cell covers
                        periods_for_cell = merged_periods_by_row.get(
                            (data_row_index, period), [period]
                        )

                        cell = _parse_asc_cell(raw_text)
                        if cell:
                            for p in periods_for_cell:
                                page_cells.append((day, p, cell))
                            page_teacher_codes.extend(cell["teacher_codes"])
                        elif kind == "faculty":
                            lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
                            subject = lines[0] if lines else raw_text
                            class_names = _asc_class_names(lines)
                            fallback_cell = {
                                "subject": subject,
                                "teacher_codes": [],
                                "class_names": class_names or ["Unknown Class"],
                            }
                            for p in periods_for_cell:
                                page_cells.append((day, p, fallback_cell))
                    data_row_index += 1

            if not page_cells:
                continue
            # Determine the page owner teacher from the top title (top < 40)
            page_text = page.extract_text() or ""
            words = page.extract_words()
            title_words = sorted([w for w in words if w['top'] < 40], key=lambda w: w['x0'])
            page_title = ' '.join(w['text'] for w in title_words).strip().upper()

            # Map title to teacher initial
            page_teacher_code = None
            if page_title:
                # 1. Check exact match or substring in DB full names
                for full_name, initial in full_name_to_initial.items():
                    if full_name == page_title or full_name in page_title or page_title in full_name:
                        page_teacher_code = initial
                        break
                
                # 2. Fallback: generate initials from title words (e.g. "KIRAN POOJARI" -> "KP")
                if not page_teacher_code:
                    title_initials = ''.join(w[0] for w in page_title.split() if w[0].isalpha())
                    if title_initials and len(title_initials) <= 5:
                        page_teacher_code = title_initials

            # 3. Fallback to most common code on page if title wasn't resolvable
            if not page_teacher_code and page_teacher_codes:
                page_teacher_code = Counter(page_teacher_codes).most_common(1)[0][0]

            if not page_teacher_code:
                continue  # Can't determine page owner, skip

            for day, period, cell in page_cells:
                if kind == "faculty":
                    teacher_codes = [page_teacher_code]
                else:
                    teacher_codes = cell["teacher_codes"]
                class_names = [page_class_name] if kind == "class" and page_class_name else cell["class_names"]
                for class_name in class_names:
                    if class_name == "Unknown Class":
                        class_name = f"Unknown Class {page_teacher_code}"
                    for teacher_code in teacher_codes[:1]:
                        rows_out.append({
                            "class_name": class_name,
                            "day": day,
                            "period": period,
                            "subject": cell["subject"],
                            "teacher": teacher_code,
                            "room": None,
                        })

        if not found_any_table:
            raise TimetableParseError(
                "No aSc timetable structure could be detected in this PDF."
            )

    unique_rows: dict[tuple[str, int, str, str], dict] = {}
    for row in rows_out:
        key = (row["day"], row["period"], row["class_name"], row["teacher"])
        unique_rows.setdefault(key, row)
    return list(unique_rows.values())


def parse_class_timetable(file_path: str) -> list[dict]:
    """
    Expects one table per class page, first row = day headers or a single
    'Period' column with day sub-columns. Returns a flat list of:
      {class_name, day, period, subject, teacher, room}
    """
    with pdfplumber.open(file_path) as pdf:
        if pdf.pages and any(_is_asc_table(table) for table in pdf.pages[0].extract_tables()):
            return _parse_asc_timetable(file_path, "class")

    rows_out: list[dict] = []

    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages:
            raise TimetableParseError("The PDF has no pages.")

        found_any_table = False
        for page in pdf.pages:
            class_name = _guess_class_name(page.extract_text() or "")
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                found_any_table = True
                header = [c.strip() if c else "" for c in table[0]]
                day_columns = {i: _normalize_day(h) for i, h in enumerate(header) if _normalize_day(h)}

                for row in table[1:]:
                    if not row or not row[0]:
                        continue
                    try:
                        period = int(re.sub(r"\D", "", row[0]) or -1)
                    except ValueError:
                        continue
                    if period < 1:
                        continue

                    for col_idx, day in day_columns.items():
                        if col_idx >= len(row):
                            continue
                        cell = _parse_cell(row[col_idx] or "")
                        if not cell:
                            continue
                        rows_out.append({
                            "class_name": class_name or "Unknown Class",
                            "day": day,
                            "period": period,
                            **cell,
                        })

        if not found_any_table:
            raise TimetableParseError(
                "No table structure could be detected in this PDF. "
                "Try exporting it as a grid/table layout rather than a scanned image."
            )

    return rows_out


def parse_faculty_timetable(file_path: str) -> list[dict]:
    """
    Faculty timetables have the same grid shape as class timetables, just
    keyed by teacher instead of class. We reuse the same extraction logic
    and swap which name we treat as the "owner" of each page.
    """
    with pdfplumber.open(file_path) as pdf:
        if pdf.pages and any(_is_asc_table(table) for table in pdf.pages[0].extract_tables()):
            return _parse_asc_timetable(file_path, "faculty")

    rows_out: list[dict] = []

    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages:
            raise TimetableParseError("The PDF has no pages.")

        found_any_table = False
        for page in pdf.pages:
            teacher_name = _guess_class_name(page.extract_text() or "", label_hint="Teacher")
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                found_any_table = True
                header = [c.strip() if c else "" for c in table[0]]
                day_columns = {i: _normalize_day(h) for i, h in enumerate(header) if _normalize_day(h)}

                for row in table[1:]:
                    if not row or not row[0]:
                        continue
                    try:
                        period = int(re.sub(r"\D", "", row[0]) or -1)
                    except ValueError:
                        continue
                    if period < 1:
                        continue

                    for col_idx, day in day_columns.items():
                        if col_idx >= len(row):
                            continue
                        cell = _parse_cell(row[col_idx] or "")
                        if not cell:
                            continue
                        rows_out.append({
                            "teacher": teacher_name or cell["teacher"],
                            "day": day,
                            "period": period,
                            "subject": cell["subject"],
                            "class_name": cell.get("room") or "Unknown Class",
                            "room": None,
                        })

        if not found_any_table:
            raise TimetableParseError(
                "No table structure could be detected in this PDF. "
                "Try exporting it as a grid/table layout rather than a scanned image."
            )

    return rows_out


def _guess_class_name(page_text: str, label_hint: str = "Class") -> str | None:
    """
    Best-effort extraction of a page's owner name from its heading text.

    The colon/dash after the label is REQUIRED (not optional) on purpose:
    a page titled "Class Timetable" also contains the word "Class", and an
    optional separator would let that match first, capturing "Timetable"
    as the class name instead of the real "Class: Grade 8A" label further
    down the heading. Requiring "Class:" or "Class -" avoids that false
    match on the page title itself.
    """
    # Character class includes apostrophes so names like "D'Souza" or
    # "O'Brien" don't break the match partway through.
    m = re.search(rf"{label_hint}\s*[:\-]\s*([A-Za-z0-9 .'\u2019]+?)(?:\n|$)", page_text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    first_line = page_text.strip().splitlines()[0] if page_text.strip() else ""
    return first_line.strip() or None
