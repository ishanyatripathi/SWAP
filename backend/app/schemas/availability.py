"""Pydantic schemas for the Teacher Availability API responses."""
from pydantic import BaseModel


class FreePeriodOut(BaseModel):
    period: int
    time_slot: str | None  # e.g. "10:00–10:45", None if timings not configured


class SubstitutionDutyOut(BaseModel):
    period: int
    time_slot: str | None
    class_name: str
    absent_teacher: str
    room: str | None = None
    subject: str | None = None


class TeacherAvailabilityOut(BaseModel):
    teacher_name: str
    free_periods: list[FreePeriodOut]
    total_free_periods: int
    substituted_periods: list[SubstitutionDutyOut] = []
    total_substituted_periods: int = 0


class PeriodFreeTeacherOut(BaseModel):
    period: int
    time_slot: str | None
    free_teachers: list[str]
    total_free: int


class AvailabilityResponse(BaseModel):
    day: str
    teacher_wise: list[TeacherAvailabilityOut]
    period_wise: list[PeriodFreeTeacherOut]
