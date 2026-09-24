from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import TrainingStatus


class TrainingCourseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    state_id: Optional[int] = None


class TrainingEnrollmentResponse(BaseModel):
    id: str
    course_id: str
    caregiver_id: str
    status: TrainingStatus
    enrolled_at: datetime
