from fastapi import APIRouter, Depends
from app.core.dependencies import (
    AdminScope,
    require_admin_scoped,
)
from app.core.supabase import get_supabase
from app.utils.pagination import PaginationParams, paginate

router = APIRouter()


@router.get("/audit-logs")
def list_audit_logs(
    params: PaginationParams = Depends(),
    scope: AdminScope = Depends(require_admin_scoped),
):
    """State-scoped audit trail for state administrators, global for super_admin."""
    supabase = get_supabase()
    query = (
        supabase.table("audit_logs")
        .select(
            "id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at, entity_state_id, users(email, state_id)",
            count="exact",
        )
        .order("created_at", desc=True)
    )

    if not scope.is_super:
        query = query.in_("entity_state_id", scope.states)

    result = paginate(query, params)
    items = result.pop("items")
    if not scope.is_super:
        for item in items:
            user_data = item.get("users")
            if user_data and user_data.get("state_id") and user_data.get("state_id") not in scope.states:
                item["users"] = None

    return {"audit_logs": items, **result}
