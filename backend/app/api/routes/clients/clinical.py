from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends

from app.core.dependencies import require_client
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase

router = APIRouter()

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SCHEDULE_STATUS_LABELS = {
    "scheduled": "Scheduled",
    "confirmed": "Confirmed",
    "completed": "Completed",
    "cancelled": "Cancelled",
}


def _format_time_12h(value):
    """Format a TIME value ('14:00:00') as a 12-hour clock string ('02:00 PM')."""
    if not value:
        return ""
    try:
        hh, mm = value.split(":")[0:2]
    except (ValueError, AttributeError):
        return str(value)
    hour = int(hh)
    minute = int(mm)
    period = "AM" if hour < 12 else "PM"
    hour12 = hour % 12 or 12
    return f"{hour12:02d}:{minute:02d} {period}"


def _fetch_care_plan(supabase, client_id):
    plan_res = (
        active_only(supabase.table("care_plans").select("*"), "care_plans")
        .eq("client_id", client_id)
        .single()
        .execute()
    )
    return plan_res.data


def _fetch_plan_activities(supabase, care_plan_id):
    if not care_plan_id:
        return []
    res = (
        active_only(
            supabase.table("care_plan_activities").select("*"),
            "care_plan_activities",
        )
        .eq("care_plan_id", care_plan_id)
        .order("sort_order")
        .execute()
    )
    return res.data or []


def _parse_date(value) -> Optional[date]:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/me/care-plan")
def get_my_care_plan(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = (
        active_only(
            supabase.table("clients").select("*, states(name, code)"),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None

    plan = _fetch_care_plan(supabase, user_id)
    if not plan:
        return {"care_plan": None}

    activities = _fetch_plan_activities(supabase, plan["id"])

    care_plan = {
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

    return {"care_plan": care_plan}


@router.get("/me/schedule")
def get_my_schedule(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = (
        active_only(
            supabase.table("clients").select("*, states(name, code)"),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )
    client = client_res.data[0] if client_res.data else None
    state_code = client.get("states", {}).get("code", "FL") if client else "FL"

    res = (
        active_only(supabase.table("care_schedules").select("*"), "care_schedules")
        .eq("client_id", user_id)
        .execute()
    )
    records = res.data or []

    def day_index(r):
        try:
            return DAY_ORDER.index(r.get("day_of_week"))
        except ValueError:
            return len(DAY_ORDER)

    records.sort(key=lambda r: (day_index(r), r.get("sort_order") or 0))

    schedule = [
        {
            "day": r.get("day_of_week"),
            "time": f"{_format_time_12h(r.get('start_time'))} - {_format_time_12h(r.get('end_time'))}",
            "service": r.get("service"),
            "status": SCHEDULE_STATUS_LABELS.get(r.get("status"), r.get("status")),
            "branch": state_code,
            "notes": r.get("notes"),
        }
        for r in records
    ]

    return {"schedule": schedule}


@router.get("/me/document-status")
def get_client_document_status(user: dict = Depends(require_client)):
    """Aggregate document health vs. the client's state's required document types."""
    supabase = get_supabase()
    user_id = user.get("sub")

    prof = (
        active_only(
            supabase.table("clients").select("state_id"),
            "clients",
        )
        .eq("id", user_id)
        .single()
        .execute()
    )
    state_id = (prof.data or {}).get("state_id")

    required = []
    if state_id:
        req_res = (
            supabase.table("document_requirements")
            .select("document_type_id, required, for_role, document_types(name)")
            .eq("state_id", state_id)
            .execute()
        )
        required = [
            r for r in (req_res.data or [])
            if r.get("for_role") in ("client", "both") or r.get("for_role") is None
        ]

    docs_res = (
        active_only(
            supabase.table("documents").select(
                "*, document_types(name, requires_expiration)"
            ),
            "documents",
        )
        .eq("owner_id", user_id)
        .execute()
    )
    docs = docs_res.data or []
    uploaded_type_ids = {d.get("document_type_id") for d in docs}

    today = date.today()
    soon_through = today + timedelta(days=30)

    missing = []
    required_panels = []
    for r in required:
        type_id = r.get("document_type_id")
        name = (r.get("document_types") or {}).get("name", "Required document")
        required_panels.append({"document_type_id": type_id, "name": name})
        if r.get("required") and type_id not in uploaded_type_ids:
            missing.append({"document_type_id": type_id, "name": name})

    expired = []
    expiring_soon = []
    valid = []
    for d in docs:
        name = (d.get("document_types") or {}).get("name", "Document")
        base = {
            "id": d.get("id"),
            "name": name,
            "status": d.get("status"),
            "expiration_date": d.get("expiration_date"),
        }
        if d.get("status") == "expired":
            expired.append(base)
            continue
        exp_date = _parse_date(d.get("expiration_date"))
        if exp_date is None or exp_date > soon_through:
            valid.append(base)
        elif exp_date < today:
            expired.append(base)
        else:
            expiring_soon.append(base)

    return {
        "state_id": state_id,
        "required_types": required_panels,
        "missing": missing,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "valid": valid,
        "summary": {
            "missing": len(missing),
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "compliant": len(missing) == 0 and len(expired) == 0,
        },
    }
