from enum import Enum


class UserRole(str, Enum):
    PUBLIC = "public"
    CAREGIVER = "caregiver"
    CLIENT = "client"
    ADMINISTRATOR = "administrator"


class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ONBOARDING = "onboarding"


# Allowed status transitions for a caregiver application.
# `rejected` is intentionally terminal for admins: only the caregiver's own
# resubmit flow (server-side in-place flip to `submitted`) reopens it.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"submitted"},
    "submitted": {"under_review", "approved", "rejected"},
    "under_review": {"approved", "rejected"},
    "approved": {"onboarding"},
    "onboarding": set(),
    "rejected": set(),
}


class DocumentStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class AuthorizationStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    REJECTED = "rejected"


class TrainingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
