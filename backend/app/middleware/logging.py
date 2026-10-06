import uuid
import time
import logging
from fastapi import Request

logger = logging.getLogger(__name__)


async def log_requests(request: Request, call_next):
    start = time.time()
    req_id = str(uuid.uuid4())
    request.state.request_id = req_id
    request.state.db_queries = 0
    request.state.db_duration = 0.0

    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Request-ID"] = req_id

    db_info = ""
    if getattr(request.state, "db_queries", 0) > 0:
        db_info = f" db_queries={request.state.db_queries} db_time={request.state.db_duration:.3f}s"

    logger.info(
        "%s %s %s %.3fs%s req_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration,
        db_info,
        req_id,
    )
    return response
