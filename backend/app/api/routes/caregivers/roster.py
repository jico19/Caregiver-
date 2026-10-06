from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import require_caregiver
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase

router = APIRouter()

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _assert_caregiver_assigned_to_client(supabase, caregiver_id: str, client_id: str):
    res = (
        supabase.table("caregiver_client_assignments")
        .select("id")
        .eq("caregiver_id", caregiver_id)
        .eq("client_id", client_id)
        .is_("ended_at", None)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access records for this client.",
        )


@router.get("/me/clients")
def get_my_clients(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    assign_res = (
        supabase.table("caregiver_client_assignments")
        .select("id, client_id, role, assigned_at, clients(id, first_name, last_name, phone, address, status, states(name, code, slug))")
        .eq("caregiver_id", user_id)
        .is_("ended_at", None)
        .execute()
    )

    clients = []
    for row in (assign_res.data or []):
        client = row.get("clients")
        if isinstance(client, dict):
            if client.get("deleted_at") is None:
                client["assignment_role"] = row.get("role")
                client["assigned_at"] = row.get("assigned_at")
                clients.append(client)
        elif row.get("client_id"):
            c_res = (
                active_only(
                    supabase.table("clients").select("id, first_name, last_name, phone, address, status, states(name, code, slug)"),
                    "clients",
                )
                .eq("id", row["client_id"])
                .execute()
            )
            if c_res.data:
                c_item = c_res.data[0]
                c_item["assignment_role"] = row.get("role")
                c_item["assigned_at"] = row.get("assigned_at")
                clients.append(c_item)

    return {"clients": clients}


@router.get("/me/clients/{client_id}/care-plan")
def get_assigned_client_care_plan(client_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    _assert_caregiver_assigned_to_client(supabase, user_id, client_id)

    client_res = (
        active_only(
            supabase.table("clients").select("id, first_name, last_name, state_id, states(name, code)"),
            "clients",
        )
        .eq("id", client_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    plan_res = (
        active_only(supabase.table("care_plans").select("*"), "care_plans")
        .eq("client_id", client_id)
        .execute()
    )
    plan = plan_res.data[0] if plan_res.data else None
    if not plan:
        return {"care_plan": None, "client": client}

    act_res = (
        active_only(supabase.table("care_plan_activities").select("*"), "care_plan_activities")
        .eq("care_plan_id", plan["id"])
        .order("sort_order")
        .execute()
    )
    activities = act_res.data or []

    care_plan = {
        "id": plan.get("id"),
        "client_id": client_id,
        "client_name": f"{client['first_name']} {client['last_name']}" if client else "Client",
        "plan_status": plan.get("status", "active"),
        "primary_nurse": plan.get("primary_nurse"),
        "effective_date": plan.get("effective_date"),
        "daily_activities": [
            {"task": a["task"], "frequency": a.get("frequency"), "notes": a.get("notes")}
            for a in activities
        ],
        "emergency_protocol": plan.get("emergency_protocol"),
    }

    return {"care_plan": care_plan, "client": client}


@router.get("/me/clients/{client_id}/schedule")
def get_assigned_client_schedule(client_id: str, user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    _assert_caregiver_assigned_to_client(supabase, user_id, client_id)

    client_res = (
        active_only(
            supabase.table("clients").select("id, first_name, last_name, state_id, states(name, code)"),
            "clients",
        )
        .eq("id", client_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    res = (
        active_only(supabase.table("care_schedules").select("*"), "care_schedules")
        .eq("client_id", client_id)
        .execute()
    )
    records = res.data or []

    def day_index(r):
        try:
            return DAY_ORDER.index(r.get("day_of_week"))
        except ValueError:
            return len(DAY_ORDER)

    records.sort(key=lambda r: (day_index(r), r.get("sort_order") or 0))

    return {"schedule": records, "client": client}
