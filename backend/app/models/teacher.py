"""
Teachers and classes.

Kept intentionally simple for the MVP: a teacher is just a name (+ optional
subject/contact for future notification features). `is_active` lets a
teacher be archived without deleting substitution history that references
them.
"""
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.db.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    subject = Column(String, nullable=True)
    phone = Column(String, nullable=True)   # reserved for future SMS/WhatsApp notifications
    email = Column(String, nullable=True)   # reserved for future login / notifications
    is_active = Column(Boolean, default=True)

    slots = relationship("TimetableSlot", back_populates="teacher")


class SchoolClass(Base):
    """A class/section, e.g. 'Grade 8A'."""
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    slots = relationship("TimetableSlot", back_populates="school_class")
