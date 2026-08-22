from pydantic import BaseModel


class PeriodTiming(BaseModel):
    period: int
    start: str
    end: str


class SchoolSettingsOut(BaseModel):
    name: str
    academic_year: str
    working_days: list[str]
    periods_per_day: int
    period_timings: list[PeriodTiming]

    class Config:
        from_attributes = True


class SchoolSettingsUpdate(BaseModel):
    name: str | None = None
    academic_year: str | None = None
    working_days: list[str] | None = None
    periods_per_day: int | None = None
    period_timings: list[PeriodTiming] | None = None
