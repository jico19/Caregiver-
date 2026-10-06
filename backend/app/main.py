import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.supabase import get_supabase
from app.core.logging_config import error_fingerprint, setup_logging
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

logger = setup_logging()


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
 
 
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    exc_type = type(exc).__name__
    logger.exception(
        "Unhandled exception on %s %s [req_id=%s]: %s",
        request.method,
        request.url.path,
        req_id,
        exc,
        extra={
            "request_id": req_id,
            "method": request.method,
            "path": request.url.path,
            "exception_type": exc_type,
            "fingerprint": error_fingerprint(exc_type, request.method, request.url.path),
        },
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": req_id,
        },
        headers={"X-Request-ID": req_id},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "Validation error on %s %s [req_id=%s]: %s",
        request.method,
        request.url.path,
        req_id,
        exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers={"X-Request-ID": req_id},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    req_id = getattr(request.state, "request_id", "unknown")
    if exc.status_code >= 500:
        exc_type = type(exc).__name__
        logger.error(
            "HTTP %s on %s %s [req_id=%s]: %s",
            exc.status_code,
            request.method,
            request.url.path,
            req_id,
            exc.detail,
            extra={
                "request_id": req_id,
                "method": request.method,
                "path": request.url.path,
                "exception_type": exc_type,
                "fingerprint": error_fingerprint(exc_type, request.method, request.url.path),
            },
        )
    elif exc.status_code >= 400:
        logger.warning(
            "HTTP %s on %s %s [req_id=%s]: %s",
            exc.status_code,
            request.method,
            request.url.path,
            req_id,
            exc.detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"X-Request-ID": req_id},
    )

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