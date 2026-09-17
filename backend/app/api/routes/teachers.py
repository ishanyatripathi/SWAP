"""Teacher CRUD — mainly used to power the searchable "absent teachers" dropdown."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.teacher import Teacher
from app.schemas.teacher import TeacherOut, TeacherCreate

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("", response_model=list[TeacherOut])
def list_teachers(db: Session = Depends(get_db)):
    teachers = db.query(Teacher).filter(Teacher.is_active.is_(True)).order_by(Teacher.name).all()
    results = []
    for t in teachers:
        display = f"{t.full_name} ({t.name})" if t.full_name else t.name
        results.append(TeacherOut(
            id=t.id,
            name=t.name,
            initials=t.name,
            full_name=t.full_name,
            display_name=display,
            subject=t.subject,
            is_active=t.is_active,
        ))
    return results


@router.post("", response_model=TeacherOut)
def create_teacher(payload: TeacherCreate, db: Session = Depends(get_db)):
    teacher = Teacher(name=payload.name, subject=payload.subject)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher
