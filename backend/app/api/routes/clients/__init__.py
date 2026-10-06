from fastapi import APIRouter

from app.api.routes.clients.agreements import AGREEMENT_TEMPLATES, router as agreements_router
from app.api.routes.clients.authorizations import router as authorizations_router
from app.api.routes.clients.clinical import router as clinical_router
from app.api.routes.clients.notifications import router as notifications_router
from app.api.routes.clients.portal import router as portal_router
from app.core.supabase import get_supabase, get_supabase_anon
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()

router.include_router(portal_router)
router.include_router(agreements_router)
router.include_router(authorizations_router)
router.include_router(clinical_router)
router.include_router(notifications_router)

# Backward-compatibility aliases
_validate_signature = validate_signature

