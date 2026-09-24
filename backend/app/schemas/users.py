from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.enums import UserRole, UserStatus


class UserBase(BaseModel):
    email: EmailStr
    role: UserRole
    state_id: Optional[int] = None
    status: UserStatus = UserStatus.ACTIVE


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
