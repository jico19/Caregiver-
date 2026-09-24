from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.models.enums import DocumentStatus


class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    document_type_id: int
    state_id: Optional[int] = None
    storage_path: str
    status: DocumentStatus
    expiration_date: Optional[date] = None
    uploaded_at: datetime
