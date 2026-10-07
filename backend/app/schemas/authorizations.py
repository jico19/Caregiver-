from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from app.models.enums import AuthorizationStatus


class AuthorizationCreate(BaseModel):
    client_id: str
    state_id: int
    authorization_number: str
    start_date: date
    end_date: date
    hcpcs_code: str = "T1019"
    service_description: str = "Personal Care Services"
    total_units_authorized: int = 0
    units_used: int = 0
    max_weekly_hours: Optional[float] = None
    unit_type: str = "15_min"
    notes: Optional[str] = None


class AuthorizationUpdate(BaseModel):
    authorization_number: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[AuthorizationStatus] = None
    hcpcs_code: Optional[str] = None
    service_description: Optional[str] = None
    total_units_authorized: Optional[int] = None
    units_used: Optional[int] = None
    max_weekly_hours: Optional[float] = None
    unit_type: Optional[str] = None


class AuthorizationResponse(BaseModel):
    id: str
    client_id: str
    state_id: int
    authorization_number: str
    start_date: date
    end_date: date
    status: AuthorizationStatus
    created_at: datetime
    notes: Optional[str] = None
    hcpcs_code: str = "T1019"
    service_description: str = "Personal Care Services"
    total_units_authorized: int = 0
    units_used: int = 0
    units_remaining: int = 0
    max_weekly_hours: Optional[float] = None
    unit_type: str = "15_min"
    remaining_hours: float = 0.0
    total_hours: float = 0.0
    hours_used: float = 0.0
