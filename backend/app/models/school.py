"""
School-level settings (single row for MVP).

Modeled as a table (not a flat config file) on purpose: the moment this
becomes a multi-school SaaS product, this table gets a real primary key
per school and a `school_id` foreign key gets added to every other model.
For the MVP there is exactly one row, id=1.
"""
from sqlalchemy import Column, Integer, String, JSON

from app.db.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="My School")
    academic_year = Column(String, default="2026-2027")
    working_days = Column(JSON, default=lambda: ["MON", "TUE", "WED", "THU", "FRI", "SAT"])
    periods_per_day = Column(Integer, default=7)
    # List of {"period": 1, "start": "08:00", "end": "08:40"}
    period_timings = Column(JSON, default=list)
