from pydantic import BaseModel


class TimetableUploadOut(BaseModel):
    id: int
    filename: str
    kind: str
    status: str
    error_message: str | None = None
    rows_imported: int
    uploaded_at: str

    class Config:
        from_attributes = True


class TimetableSlotOut(BaseModel):
    day: str
    period: int
    subject: str | None
    room: str | None
    teacher_name: str
    class_name: str
