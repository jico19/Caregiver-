from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.core.dependencies import (
    AdminScope,
    assert_permitted_filter,
    require_admin_scoped,
    scope_query,
)
from app.core.supabase import get_supabase
from app.core.soft_delete import active_only

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
    state: Optional[str] = Query(None),
    scope: AdminScope = Depends(require_admin_scoped),
):
    """Aggregate dashboard metrics constrained to the admin caller's scope."""
    supabase = get_supabase()

    caregivers_q = scope_query(
        active_only(
            supabase.table("caregivers").select("id", count="exact"),
            "caregivers",
        ),
        scope,
    )
    clients_q = scope_query(
        active_only(
            supabase.table("clients").select("id", count="exact"),
            "clients",
        ),
        scope,
    )
    apps_pending_q = scope_query(
        active_only(
            supabase.table("caregiver_applications")
            .select("id", count="exact")
            .in_("status", ["submitted", "under_review"]),
            "caregiver_applications",
        ),
        scope,
    )
    docs_pending_q = scope_query(
        active_only(
            supabase.table("documents")
            .select("id", count="exact")
            .eq("status", "pending_review"),
            "documents",
        ),
        scope,
    )

    if state and state != "all":
        state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
        if state_row.data:
            s_id = assert_permitted_filter(scope, state_row.data["id"])
            caregivers_q = caregivers_q.eq("state_id", s_id)
            clients_q = clients_q.eq("state_id", s_id)
            apps_pending_q = apps_pending_q.eq("state_id", s_id)
            docs_pending_q = docs_pending_q.eq("state_id", s_id)

    caregivers_res = caregivers_q.execute()
    clients_res = clients_q.execute()
    apps_res = apps_pending_q.execute()
    docs_res = docs_pending_q.execute()

    return {
        "metrics": {
            "total_caregivers": caregivers_res.count or 0,
            "total_clients": clients_res.count or 0,
            "pending_applications": apps_res.count or 0,
            "pending_documents": docs_res.count or 0,
        }
    }
