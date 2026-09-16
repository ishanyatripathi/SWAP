"""
The master timetable, stored as one row per (day, period, class).

This single table is the source of truth for both the "faculty view"
(what is this teacher teaching right now) and the "class view" (who
teaches this class right now) — both are just different queries/filters
over the same rows. That's what lets the substitution engine answer
"who is free at period 3 on Monday" with one query instead of
reconciling two separate documents, which is exactly the manual pain
point this product removes.

Rows are created by the PDF parser on first-time setup and are edited
in place when a new timetable PDF is uploaded (see services/pdf_parser.py).
"""
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"
    __table_args__ = (
        # A teacher can only have one assigned slot per period per day.
        # Multiple teachers can teach different batches of the same class (electives/labs/languages).
        UniqueConstraint("day", "period", "teacher_id", name="uq_teacher_period_day"),
    )

    id = Column(Integer, primary_key=True, index=True)
    day = Column(String, nullable=False)          # "MON", "TUE", ...
    period = Column(Integer, nullable=False)      # 1, 2, 3, ...
    subject = Column(String, nullable=True)
    room = Column(String, nullable=True)

    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)

    teacher = relationship("Teacher", back_populates="slots")
    school_class = relationship("SchoolClass", back_populates="slots")


class TimetableUpload(Base):
    """Audit trail of every timetable PDF uploaded (for the Timetables page)."""
    __tablename__ = "timetable_uploads"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    kind = Column(String, nullable=False)          # "faculty" | "class"
    status = Column(String, default="processing")  # processing | success | failed
    error_message = Column(String, nullable=True)
    rows_imported = Column(Integer, default=0)
    uploaded_at = Column(String, nullable=False)    # ISO timestamp
