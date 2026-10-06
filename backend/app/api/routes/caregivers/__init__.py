from fastapi import APIRouter

from app.api.routes.caregivers.applications import router as applications_router
from app.api.routes.caregivers.communications import router as communications_router
from app.api.routes.caregivers.documents import router as documents_router
from app.api.routes.caregivers.portal import router as portal_router
from app.api.routes.caregivers.roster import router as roster_router
from app.core.supabase import get_supabase, get_supabase_anon
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()

router.include_router(portal_router)
router.include_router(applications_router)
router.include_router(documents_router)
router.include_router(roster_router)
router.include_router(communications_router)

# Backward compatibility alias
_validate_signature = validate_signature

