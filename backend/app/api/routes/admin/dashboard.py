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
    """Aggregate dashboard metrics, recent intakes, tasks, and announcements constrained to admin scope."""
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
    new_referrals_q = scope_query(
        active_only(
            supabase.table("client_referrals")
            .select("id", count="exact")
            .eq("status", "new"),
            "client_referrals",
        ),
        scope,
    )
    recent_intakes_q = scope_query(
        active_only(
            supabase.table("client_referrals")
            .select("id, state_id, first_name, last_name, referral_source, status, created_at"),
            "client_referrals",
        ),
        scope,
    ).order("created_at", desc=True).limit(5)

    announcements_q = active_only(
        supabase.table("announcements")
        .select("id, title, body, audience, state_id, created_at")
        .eq("is_active", True)
        .in_("audience", ["all", "administrator"]),
        "announcements",
    ).order("created_at", desc=True).limit(5)

    if state and state != "all":
        state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
        if state_row.data:
            s_id = assert_permitted_filter(scope, state_row.data["id"])
            caregivers_q = caregivers_q.eq("state_id", s_id)
            clients_q = clients_q.eq("state_id", s_id)
            apps_pending_q = apps_pending_q.eq("state_id", s_id)
            docs_pending_q = docs_pending_q.eq("state_id", s_id)
            new_referrals_q = new_referrals_q.eq("state_id", s_id)
            recent_intakes_q = recent_intakes_q.eq("state_id", s_id)

    caregivers_res = caregivers_q.execute()
    clients_res = clients_q.execute()
    apps_res = apps_pending_q.execute()
    docs_res = docs_pending_q.execute()
    referrals_res = new_referrals_q.execute()
    recent_intakes_res = recent_intakes_q.execute()
    announcements_res = announcements_q.execute()

    pending_apps = apps_res.count or 0
    pending_docs = docs_res.count or 0
    new_referrals = referrals_res.count or 0

    open_tasks = []
    if pending_apps > 0:
        open_tasks.append({
            "id": "task-apps",
            "title": f"Review {pending_apps} pending caregiver application{'s' if pending_apps > 1 else ''}",
            "priority": "high",
            "category": "compliance",
            "target_url": "/admin/caregivers",
            "count": pending_apps,
        })
    if pending_docs > 0:
        open_tasks.append({
            "id": "task-docs",
            "title": f"Verify {pending_docs} document{'s' if pending_docs > 1 else ''} pending review",
            "priority": "medium",
            "category": "compliance",
            "target_url": "/admin/documents",
            "count": pending_docs,
        })
    if new_referrals > 0:
        open_tasks.append({
            "id": "task-referrals",
            "title": f"Follow up on {new_referrals} new client referral{'s' if new_referrals > 1 else ''}",
            "priority": "high",
            "category": "intake",
            "target_url": "/admin/referrals",
            "count": new_referrals,
        })

    announcements_data = announcements_res.data or []
    if not scope.is_super and scope.states:
        announcements_data = [
            a for a in announcements_data
            if a.get("state_id") is None or a.get("state_id") in scope.states
        ]

    return {
        "metrics": {
            "total_caregivers": caregivers_res.count or 0,
            "total_clients": clients_res.count or 0,
            "pending_applications": pending_apps,
            "pending_documents": pending_docs,
            "new_referrals": new_referrals,
            "pending_compliance": pending_apps + pending_docs,
        },
        "recent_intakes": recent_intakes_res.data or [],
        "open_tasks": open_tasks,
        "announcements": announcements_data,
    }
