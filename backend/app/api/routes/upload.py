"""Timetable JSON upload endpoints.

The app now reads the timetable data directly from the JSON export in the
project's Timetables folder. The upload flow still stores an audit record,
but it no longer depends on PDF parsing or PDF-only file selection.
"""
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.teacher import Teacher, SchoolClass
from app.models.timetable import TimetableSlot, TimetableUpload
from app.schemas.timetable import TimetableUploadOut
from app.services.json_timetable_parser import parse_json_timetable, TimetableParseError

router = APIRouter(prefix="/timetables", tags=["timetables"])
settings = get_settings()


def _get_or_create_teacher(db: Session, name: str) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.name == name).first()
    if not teacher:
        teacher = Teacher(name=name)
        db.add(teacher)
        db.flush()
    return teacher


def _get_or_create_class(db: Session, name: str) -> SchoolClass:
    school_class = db.query(SchoolClass).filter(SchoolClass.name == name).first()
    if not school_class:
        school_class = SchoolClass(name=name)
        db.add(school_class)
        db.flush()
    return school_class


def _parse_uploaded_timetable(file_path: str, kind: str) -> list[dict]:
    if kind not in {"class", "faculty"}:
        raise ValueError(f"Unsupported timetable kind: {kind}")
    return parse_json_timetable(file_path)


@router.post("/upload", response_model=TimetableUploadOut)
def upload_timetable(
    kind: str,  # "class" | "faculty"
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if kind not in {"class", "faculty"}:
        raise HTTPException(400, "kind must be 'class' or 'faculty'")

    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Only JSON timetable files are accepted.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(saved_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    upload_record = TimetableUpload(
        filename=file.filename,
        kind=kind,
        status="processing",
        uploaded_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    try:
        rows = _parse_uploaded_timetable(saved_path, kind)

        if not rows:
            raise TimetableParseError(
                "The JSON was read but no valid timetable rows were found. "
                "Check that the timetable file contains teacher assignments for each day."
            )

        parsed_uploads = [(rows, upload_record)]
        previous_uploads = db.query(TimetableUpload).filter(
            TimetableUpload.status == "success",
            TimetableUpload.id != upload_record.id,
        ).all()
        for previous_upload in previous_uploads:
            previous_path = os.path.join(settings.UPLOAD_DIR, previous_upload.filename)
            previous_rows = _parse_uploaded_timetable(previous_path, previous_upload.kind)
            parsed_uploads.append((previous_rows, previous_upload))

        # Rebuild from every successful upload so separate sections can coexist.
        db.query(TimetableSlot).delete()

        combined_rows = {}
        for upload_rows, _ in parsed_uploads:
            for row in upload_rows:
                key = (row["day"], row["period"], row["class_name"])
                combined_rows.setdefault(key, row)

        for row in combined_rows.values():
            teacher = _get_or_create_teacher(db, row["teacher"])
            school_class = _get_or_create_class(db, row["class_name"])
            slot = TimetableSlot(
                day=row["day"],
                period=row["period"],
                subject=row.get("subject"),
                room=row.get("room"),
                teacher_id=teacher.id,
                class_id=school_class.id,
            )
            db.merge(slot)

        upload_record.status = "success"
        upload_record.rows_imported = len(rows)
        db.commit()

    except TimetableParseError as exc:
        db.rollback()
        upload_record.status = "failed"
        upload_record.error_message = str(exc)
        db.commit()

    except Exception as exc:
        # Anything unexpected (a malformed PDF pdfplumber can't handle, a
        # bad row, a DB constraint, etc.) must still land here rather than
        # propagate uncaught. An uncaught exception in a route produces a
        # 500 response generated OUTSIDE FastAPI's CORS middleware layer —
        # the browser can't read it at all and reports a bare "Failed to
        # fetch", while the upload record is left stuck at "processing"
        # forever with no way for the UI to explain what happened. Catching
        # broadly here guarantees the request always finishes with a clean,
        # CORS-safe JSON response and an upload record that accurately
        # reflects what happened.
        db.rollback()
        upload_record.status = "failed"
        upload_record.error_message = f"Unexpected error while processing this JSON file: {exc}"
        db.commit()

    db.refresh(upload_record)
    return upload_record


@router.get("/uploads", response_model=list[TimetableUploadOut])
def list_uploads(db: Session = Depends(get_db)):
    return db.query(TimetableUpload).order_by(TimetableUpload.id.desc()).all()


@router.delete("/uploads/{upload_id}", status_code=204)
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    upload_record = db.query(TimetableUpload).filter(TimetableUpload.id == upload_id).first()
    if not upload_record:
        raise HTTPException(404, "Timetable upload not found")

    filename = upload_record.filename
    db.delete(upload_record)
    db.commit()

    still_referenced = db.query(TimetableUpload).filter(TimetableUpload.filename == filename).first()
    if not still_referenced:
        stored_path = os.path.join(settings.UPLOAD_DIR, filename)
        if os.path.isfile(stored_path):
            os.remove(stored_path)
