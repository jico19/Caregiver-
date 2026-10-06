import uuid
import time
import logging
from fastapi import Request

from app.core.supabase import db_metrics

logger = logging.getLogger(__name__)
access_logger = logging.getLogger("app.access")


async def log_requests(request: Request, call_next):
    start = time.time()
    req_id = str(uuid.uuid4())
    request.state.request_id = req_id

    # Initialize contextvar for this request
    metrics = {"queries": 0, "duration": 0.0}
    token = db_metrics.set(metrics)

    try:
        response = await call_next(request)
    finally:
        db_metrics.reset(token)

    request.state.db_queries = metrics["queries"]
    request.state.db_duration = metrics["duration"]

    duration = time.time() - start
    response.headers["X-Request-ID"] = req_id

    db_info = ""
    if metrics["queries"] > 0:
        db_info = f" db_queries={metrics['queries']} db_time={metrics['duration']:.3f}s"

    msg = "%s %s %s %.3fs%s req_id=%s"
    args = (request.method, request.url.path, response.status_code, duration, db_info, req_id)

    # 5xx access lines stay at INFO so error.log is owned by exception handlers.
    if response.status_code >= 500:
        access_logger.info(msg, *args)
    elif response.status_code >= 400:
        access_logger.warning(msg, *args)
    else:
        access_logger.info(msg, *args)

    return response
