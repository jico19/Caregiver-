from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class ClientIntakeSubmit(BaseModel):
    state_id: int
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    medicaid_number: Optional[str] = Field(None, max_length=50)
    signature_data: Optional[str] = None
    signed_name: Optional[str] = None


class AgreementSignSubmit(BaseModel):
    signature_data: str = Field(..., min_length=1)
    signed_name: str = Field(..., min_length=1, max_length=200)


class ClientResponse(BaseModel):
    id: str
    state_id: int
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    medicaid_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
