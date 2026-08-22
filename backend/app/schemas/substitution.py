from pydantic import BaseModel


class PreviewRequest(BaseModel):
    date: str                       # "YYYY-MM-DD"
    absent_teacher_names: list[str]


class CoverageOptionOut(BaseModel):
    """One lecture needing coverage, with every free teacher as a candidate."""
    period: int
    time_slot: str | None
    class_name: str
    subject: str | None
    room: str | None
    absent_teacher: str
    free_teachers: list[str]
    suggested_substitute: str | None


class ConfirmedEntry(BaseModel):
    """The coordinator's final choice for one lecture (may differ from the suggestion)."""
    period: int
    class_name: str
    subject: str | None = None
    room: str | None = None
    absent_teacher: str
    substitute_teacher: str | None = None  # None = left unassigned on purpose


class ConfirmRequest(BaseModel):
    date: str
    absent_teacher_names: list[str]
    entries: list[ConfirmedEntry]


class GenerateSubstitutionRequest(BaseModel):
    """Used only by the fully-automatic /generate endpoint."""
    date: str
    absent_teacher_names: list[str]


class SubstitutionEntryOut(BaseModel):
    period: int
    time_slot: str | None
    class_name: str
    subject: str | None
    room: str | None
    absent_teacher: str
    substitute_teacher: str | None
    status: str

    class Config:
        from_attributes = True


class SubstitutionRunOut(BaseModel):
    id: int
    date: str
    absent_teacher_names: list[str]
    created_at: str
    entries: list[SubstitutionEntryOut]

    class Config:
        from_attributes = True
