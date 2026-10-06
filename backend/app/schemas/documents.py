from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date
from app.models.enums import DocumentStatus


class DocumentTypeInfo(BaseModel):
    name: Optional[str] = None
    requires_expiration: Optional[bool] = None


class DocumentTypeItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    for_role: str
    requires_expiration: bool


class DocumentTypeListResponse(BaseModel):
    document_types: list[DocumentTypeItem]


class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    document_type_id: int
    state_id: Optional[int] = None
    storage_path: Optional[str] = None
    status: DocumentStatus
    expiration_date: Optional[date] = None
    uploaded_at: datetime
    document_types: Optional[DocumentTypeInfo] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
