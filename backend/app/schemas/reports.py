from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ComplianceRow(BaseModel):
    caregiver_id: str
    name: str
    email: Optional[str] = None
    state_code: str
    missing: int
    expired: int
    expiring_soon: int
    valid: int
    missing_names: list[str] = []
    compliant: bool


class CaregiverComplianceSection(BaseModel):
    total: int
    compliant: int
    rows: list[ComplianceRow]


class CredentialRow(BaseModel):
    caregiver_id: str
    caregiver_name: str
    state_code: str
    document_name: str
    expiration_date: Optional[str] = None
    days_remaining: int
    status: str


class ExpiringCredentialsSection(BaseModel):
    total: int
    rows: list[CredentialRow]


class CourseStatRow(BaseModel):
    course_id: Any
    name: str
    state_code: str
    enrolled: int
    completed: int
    completion_pct: int


class TrainingCompletionSection(BaseModel):
    total_courses: int
    rows: list[CourseStatRow]


class AuthorizationRow(BaseModel):
    authorization_number: Optional[str] = None
    client_name: str
    state_code: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    days_left: Optional[int] = None


class ClientAuthorizationsSection(BaseModel):
    summary: dict[str, int]
    rows: list[AuthorizationRow]


class ReferralStateCount(BaseModel):
    code: str
    count: int


class ReferralSourceRow(BaseModel):
    source: str
    count: int
    states: list[ReferralStateCount]


class ReferralSourcesSection(BaseModel):
    total: int
    rows: list[ReferralSourceRow]


class WebsiteInquiryRecent(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    state_code: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class WebsiteInquiriesSection(BaseModel):
    total: int
    by_state: list[ReferralStateCount]
    recent: list[WebsiteInquiryRecent]


class AdminReportsResponse(BaseModel):
    generated_at: str
    caregiver_compliance: CaregiverComplianceSection
    expiring_credentials: ExpiringCredentialsSection
    training_completion: TrainingCompletionSection
    client_authorizations: ClientAuthorizationsSection
    referral_sources: ReferralSourcesSection
    website_inquiries: WebsiteInquiriesSection
