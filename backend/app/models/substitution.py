"""
Generated substitution runs.

A `SubstitutionRun` is one "Generate Substitution" click for one day —
it groups all the individual `SubstitutionEntry` rows so the History
page can list past days and drill into each one.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base


class SubstitutionRun(Base):
    __tablename__ = "substitution_runs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False, index=True)   # "YYYY-MM-DD"
    absent_teacher_names = Column(JSON, default=list)
    created_at = Column(String, nullable=False)

    entries = relationship("SubstitutionEntry", back_populates="run", cascade="all, delete-orphan")


class SubstitutionEntry(Base):
    __tablename__ = "substitution_entries"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("substitution_runs.id"), nullable=False)

    period = Column(Integer, nullable=False)
    time_slot = Column(String, nullable=True)
    class_name = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    room = Column(String, nullable=True)
    absent_teacher = Column(String, nullable=False)
    substitute_teacher = Column(String, nullable=True)   # null if unassigned
    status = Column(String, nullable=False)              # "Assigned" | "Unassigned"

    run = relationship("SubstitutionRun", back_populates="entries")
