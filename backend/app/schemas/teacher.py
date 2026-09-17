from pydantic import BaseModel


class TeacherOut(BaseModel):
    id: int
    name: str  # initials code (e.g. "AED")
    initials: str | None = None
    full_name: str | None = None
    display_name: str | None = None
    subject: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class TeacherCreate(BaseModel):
    name: str
    subject: str | None = None
