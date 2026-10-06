import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.supabase import get_supabase
from app.jobs.credential_reminders import scan_due_credentials
from app.jobs.authorization_reminders import scan_due_authorizations
from app.jobs.training_reminders import scan_due_training
from app.jobs.retention_purge import run_retention_purge
from app.middleware.logging import log_requests
from app.api.routes import (
    auth, states,
    caregivers, clients, documents,
    training, admin,
    admin_users
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("app")


async def _periodic_job_loop(job_func, job_name: str):
    while True:
        try:
            await asyncio.to_thread(job_func, get_supabase())
        except Exception:  # pragma: no cover
            logger.exception("%s scan failed", job_name)
        await asyncio.sleep(24 * 60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.APP_NAME)
    tasks = [
        asyncio.create_task(_periodic_job_loop(scan_due_credentials, "credential reminder")),
        asyncio.create_task(_periodic_job_loop(scan_due_authorizations, "authorization reminder")),
        asyncio.create_task(_periodic_job_loop(scan_due_training, "training reminder")),
        asyncio.create_task(_periodic_job_loop(run_retention_purge, "retention purge")),
    ]
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        logger.info("Shutting down")


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

app.middleware("http")(log_requests)

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(states.router, prefix=f"{API_PREFIX}/states", tags=["states"])
app.include_router(caregivers.router, prefix=f"{API_PREFIX}/caregivers", tags=["caregivers"])
app.include_router(clients.router, prefix=f"{API_PREFIX}/clients", tags=["clients"])
app.include_router(documents.router, prefix=f"{API_PREFIX}/documents", tags=["documents"])
app.include_router(training.router, prefix=f"{API_PREFIX}/training", tags=["training"])
app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["admin"])
app.include_router(admin_users.router, prefix=f"{API_PREFIX}/admin/users", tags=["admin-users"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}