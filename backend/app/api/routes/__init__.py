"""API route modules and unified router."""
from fastapi import APIRouter

from app.api.routes import admin, auth, caregivers, clients, documents, states, training
from app.api.routes.admin import users as admin_users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(states.router, prefix="/states", tags=["states"])
api_router.include_router(caregivers.router, prefix="/caregivers", tags=["caregivers"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

__all__ = [
    "admin",
    "admin_users",
    "api_router",
    "auth",
    "caregivers",
    "clients",
    "documents",
    "states",
    "training",
]
