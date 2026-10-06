from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime, date
from app.models.enums import ApplicationStatus


class CaregiverProfileUpdate(BaseModel):
    state_id: int
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    ssn_last4: Optional[str] = Field(None, min_length=4, max_length=4)


class CaregiverApplicationSubmit(CaregiverProfileUpdate):
    notes: Optional[str] = None
    signature_data: Optional[str] = Field(None, max_length=250000)
    signed_name: Optional[str] = None


class PublicCaregiverApplicationSubmit(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    state_id: int
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    ssn_last4: Optional[str] = Field(None, min_length=4, max_length=4)
    notes: Optional[str] = None
    signature_data: Optional[str] = Field(None, max_length=250000)
    signed_name: Optional[str] = None


class CaregiverApplicationResponse(BaseModel):
    id: str
    caregiver_id: str
    state_id: int
    status: ApplicationStatus
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CaregiverEmbeddedInfo(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    ssn_last4: Optional[str] = None
    date_of_birth: Optional[date] = None


class StateEmbeddedInfo(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    slug: Optional[str] = None


class CaregiverApplicationListItem(BaseModel):
    id: str
    caregiver_id: Optional[str] = None
    state_id: Optional[int] = None
    status: str
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    caregivers: Optional[CaregiverEmbeddedInfo] = None
    states: Optional[StateEmbeddedInfo] = None


class CaregiverApplicationListResponse(BaseModel):
    applications: list[CaregiverApplicationListItem]
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0
