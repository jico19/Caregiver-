from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.models.enums import AuthorizationStatus


class AuthorizationCreate(BaseModel):
    client_id: str
    state_id: int
    authorization_number: str
    start_date: date
    end_date: date


class AuthorizationResponse(BaseModel):
    id: str
    client_id: str
    state_id: int
    authorization_number: str
    start_date: date
    end_date: date
    status: AuthorizationStatus
    created_at: datetime
