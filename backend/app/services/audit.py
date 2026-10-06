import logging
from typing import Optional
from fastapi import HTTPException, Request, status
from app.core.config import settings

logger = logging.getLogger(__name__)


def sanitize_audit_values(values: Optional[dict]) -> Optional[dict]:
    """Sanitize audit payload values by dropping heavy blobs and truncated strings."""
    if not values or not isinstance(values, dict):
        return values
    cleaned = {}
    for k, v in values.items():
        if k == "signature_data":
            continue
        if isinstance(v, str) and len(v) > 2000:
            continue
        cleaned[k] = v
    return cleaned


_sanitize_audit_values = sanitize_audit_values


def record_audit_log(
    supabase,
    user_id: Optional[str],
    action: str,
    table_name: str,
    record_id: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    request: Optional[Request] = None,
    required: bool = False,
    entity_state_id: Optional[int] = None,
):
    """Canonical audit logging helper writing to public.audit_logs."""
    ip_address = None
    user_agent = None
    request_id = None

    if request is not None:
        user_agent = request.headers.get("user-agent")
        request_id = getattr(request.state, "request_id", None)
        if settings.TRUST_FORWARDED_FOR and request.headers.get("x-forwarded-for"):
            ip_address = request.headers.get("x-forwarded-for").split(",")[0].strip()
        elif request.client:
            ip_address = request.client.host

    payload = {
        "user_id": user_id,
        "action": action,
        "table_name": table_name,
        "record_id": str(record_id),
        "old_values": sanitize_audit_values(old_values),
        "new_values": sanitize_audit_values(new_values),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "request_id": request_id,
        "entity_state_id": entity_state_id,
    }

    try:
        supabase.table("audit_logs").insert(payload).execute()
    except Exception as exc:
        logger.warning("audit_logs insert failed (action=%s, record=%s): %s", action, record_id, exc)
        if required:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Audit logging failed for critical operation.",
            )
