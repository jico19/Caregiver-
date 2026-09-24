from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.core.supabase import get_supabase
from app.jobs.credential_reminders import scan_due_credentials
from app.api.routes import (
    auth, states, services, forms,
    caregivers, clients, documents,
    training, authorizations, admin
)


async def _credential_reminder_loop():
    while True:
        try:
            scan_due_credentials(get_supabase())
        except Exception as exc:  # pragma: no cover
            print(f"[jobs] credential reminder scan failed: {exc}")
        await asyncio.sleep(24 * 60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {settings.APP_NAME}")
    reminder_task = asyncio.create_task(_credential_reminder_loop())
    try:
        yield
    finally:
        reminder_task.cancel()
        print("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(states.router, prefix=f"{API_PREFIX}/states", tags=["states"])
app.include_router(services.router, prefix=f"{API_PREFIX}/services", tags=["services"])
app.include_router(forms.router, prefix=f"{API_PREFIX}/forms", tags=["forms"])
app.include_router(caregivers.router, prefix=f"{API_PREFIX}/caregivers", tags=["caregivers"])
app.include_router(clients.router, prefix=f"{API_PREFIX}/clients", tags=["clients"])
app.include_router(documents.router, prefix=f"{API_PREFIX}/documents", tags=["documents"])
app.include_router(training.router, prefix=f"{API_PREFIX}/training", tags=["training"])
app.include_router(authorizations.router, prefix=f"{API_PREFIX}/authorizations", tags=["authorizations"])
app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["admin"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
