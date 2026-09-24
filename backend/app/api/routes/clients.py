from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.core.dependencies import require_client
from app.core.supabase import get_supabase
from app.schemas.clients import ClientIntakeSubmit
from app.utils.notifications import notify

router = APIRouter()


class ClientProfileUpdate(BaseModel):
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    medicaid_number: Optional[str] = Field(None, max_length=50)


@router.get("/me")
async def get_my_profile(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("clients")
        .select("*, states(name, code, slug)")
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.patch("/me/profile")
async def update_my_profile(
    payload: ClientProfileUpdate,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    update_data = {}
    if payload.phone is not None:
        update_data["phone"] = payload.phone.strip() or None
    if payload.address is not None:
        update_data["address"] = payload.address.strip() or None
    if payload.medicaid_number is not None:
        update_data["medicaid_number"] = payload.medicaid_number.strip() or None

    res = supabase.table("clients").update(update_data).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.post("/intake")
async def submit_intake(
    payload: ClientIntakeSubmit,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "phone": payload.phone,
        "address": payload.address,
        "medicaid_number": payload.medicaid_number,
    }

    res = supabase.table("clients").upsert(client_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client profile.",
        )

    supabase.table("users").update({"state_id": payload.state_id}).eq("id", user_id).execute()

    notify(
        supabase,
        user_id,
        "intake_submitted",
        "Intake Submitted",
        "Your client intake details have been recorded. An agency care coordinator will reach out shortly.",
    )

    return {
        "message": "Client intake details saved successfully.",
        "profile": res.data[0],
    }


@router.get("/me/authorizations")
async def get_my_authorizations(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("authorizations")
        .select("*, states(name, code, slug)")
        .eq("client_id", user_id)
        .order("end_date", desc=True)
        .execute()
    )

    records = res.data or []
    today = date.today()

    computed_list = []
    for auth in records:
        end_d = datetime.strptime(auth["end_date"], "%Y-%m-%d").date() if auth.get("end_date") else None
        days_left = (end_d - today).days if end_d else None

        auth_status = auth.get("status", "pending")
        if auth_status == "active" and days_left is not None and 0 <= days_left <= 30:
            auth_status = "expiring_soon"
        elif end_d and end_d < today:
            auth_status = "expired"

        computed_list.append({
            **auth,
            "status": auth_status,
            "days_until_expiration": days_left,
        })

    return {"authorizations": computed_list}


@router.get("/me/care-plan")
async def get_my_care_plan(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    # Fetch client info
    client_res = supabase.table("clients").select("*, states(name, code)").eq("id", user_id).execute()
    client = client_res.data[0] if client_res.data else None

    # Structured care plan
    care_plan = {
        "client_name": f"{client['first_name']} {client['last_name']}" if client else "Client",
        "plan_status": "active" if client else "pending_intake",
        "primary_nurse": "Registered Nurse Supervisor (RN)",
        "effective_date": client["created_at"][:10] if client else str(date.today()),
        "daily_activities": [
            {"task": "Personal Hygiene & Grooming", "frequency": "Daily (Morning)", "notes": "Assistance with bathing and dressing."},
            {"task": "Meal Preparation & Hydration", "frequency": "Daily (Lunch & Dinner)", "notes": "Low-sodium dietary support."},
            {"task": "Medication Reminders", "frequency": "Twice daily", "notes": "Verify client self-administers prescribed medicines."},
            {"task": "Mobility & Fall Prevention", "frequency": "As needed", "notes": "Support with transfers and light ambulation."},
            {"task": "Light Housekeeping & Sanitization", "frequency": "3x / week", "notes": "Keep client care area tidy and clean."},
        ],
        "emergency_protocol": "In event of medical emergency, contact 911 immediately, then notify agency on-call supervisor.",
    }

    return {"care_plan": care_plan}


@router.get("/me/schedule")
async def get_my_schedule(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    client_res = supabase.table("clients").select("*, states(name, code)").eq("id", user_id).execute()
    client = client_res.data[0] if client_res.data else None
    state_code = client.get("states", {}).get("code", "FL") if client else "FL"

    # Standard upcoming shifts preview
    sample_schedule = [
        {"day": "Monday", "time": "09:00 AM - 01:00 PM", "service": "Personal Care Assistance", "status": "Confirmed", "branch": state_code},
        {"day": "Wednesday", "time": "09:00 AM - 01:00 PM", "service": "Personal Care Assistance", "status": "Confirmed", "branch": state_code},
        {"day": "Friday", "time": "09:00 AM - 01:00 PM", "service": "Personal Care & Homemaking", "status": "Scheduled", "branch": state_code},
        {"day": "Saturday", "time": "10:00 AM - 02:00 PM", "service": "Respite Care Support", "status": "Scheduled", "branch": state_code},
    ]

    return {"schedule": sample_schedule}


@router.get("/me/notifications")
async def get_my_notifications(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"notifications": res.data or []}


@router.patch("/me/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    supabase.table("notifications").update({"read": True}).eq("id", notification_id).eq("user_id", user_id).execute()

    return {"message": "Notification marked as read"}
