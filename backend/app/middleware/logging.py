import uuid
import time
import logging
from fastapi import Request

logger = logging.getLogger(__name__)


async def log_requests(request: Request, call_next):
    start = time.time()
    req_id = str(uuid.uuid4())
    request.state.request_id = req_id
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Request-ID"] = req_id
    logger.info("%s %s %s %.3fs req_id=%s", request.method, request.url.path, response.status_code, duration, req_id)
    return response
