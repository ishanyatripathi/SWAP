from pydantic import BaseModel


class TeacherOut(BaseModel):
    id: int
    name: str
    subject: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class TeacherCreate(BaseModel):
    name: str
    subject: str | None = None
