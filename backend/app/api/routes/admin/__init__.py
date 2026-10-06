from fastapi import APIRouter
from app.core.supabase import get_supabase
from app.services.audit import record_audit_log, _sanitize_audit_values
from app.utils.notifications import notify

from .dashboard import router as dashboard_router
from .caregivers import router as caregivers_router
from .clients import router as clients_router
from .care_plans import router as care_plans_router
from .schedules import router as schedules_router
from .authorizations import router as authorizations_router
from .audit_logs import router as audit_logs_router
from .announcements import router as announcements_router
from .referrals import router as referrals_router
from .reports import router as reports_router
from .documents import router as documents_router
from .training import router as training_router
from .settings import router as settings_router
from .legal_hold import router as legal_hold_router
from .assignments import router as assignments_router
from .restore import router as restore_router

router = APIRouter()

router.include_router(dashboard_router)
router.include_router(caregivers_router)
router.include_router(clients_router)
router.include_router(care_plans_router)
router.include_router(schedules_router)
router.include_router(authorizations_router)
router.include_router(audit_logs_router)
router.include_router(announcements_router)
router.include_router(referrals_router)
router.include_router(reports_router)
router.include_router(documents_router)
router.include_router(training_router)
router.include_router(settings_router)
router.include_router(legal_hold_router)
router.include_router(assignments_router)
router.include_router(restore_router)

__all__ = ["router", "get_supabase", "notify", "record_audit_log"]
