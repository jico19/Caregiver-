from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.dependencies import require_caregiver, validate_state_id
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase
from app.schemas.caregivers import CaregiverApplicationSubmit, CaregiverProfileUpdate
from app.services.audit import record_audit_log
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()


@router.get("/me")
def get_my_profile(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("caregivers").select(
                "id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4, created_at, updated_at, legal_hold, states(name, code, slug)"
            ),
            "caregivers",
        )
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.get("/me/application")
def get_my_application(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("caregiver_applications").select(
                "id, caregiver_id, state_id, status, submitted_at, reviewed_at, reviewed_by, notes, rejection_reason, created_at, updated_at, states(name, code, slug)"
            ),
            "caregiver_applications",
        )
        .eq("caregiver_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        return {"application": None}

    return {"application": res.data[0]}


@router.patch("/me/profile")
def update_my_profile(
    payload: CaregiverProfileUpdate,
    request: Request,
    user: dict = Depends(require_caregiver),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    current_state_id = user.get("state_id")
    if payload.state_id != current_state_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to change your assigned state.",
        )

    validate_state_id(supabase, current_state_id)

    profile_data = {
        "id": user_id,
        "state_id": current_state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }

    res = supabase.table("caregivers").upsert(profile_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver profile.",
        )

    (
        active_only(
            supabase.table("users").update({"state_id": current_state_id}),
            "users",
        )
        .eq("id", user_id)
        .execute()
    )

    record_audit_log(
        supabase,
        user_id=user_id,
        action="caregiver_profile_updated",
        table_name="caregivers",
        record_id=str(user_id),
        new_values=profile_data,
        request=request,
        entity_state_id=current_state_id,
    )

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.post("/applications/resubmit")
def resubmit_application(
    payload: CaregiverApplicationSubmit,
    user: dict = Depends(require_caregiver),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    signature = validate_signature(
        payload,
        empty_detail="A drawn signature is required to submit your application.",
        name_detail="Your full name is required to sign the application.",
    )

    validate_state_id(supabase, payload.state_id)

    # 1. Load most recent live application for this caregiver
    app_q = (
        active_only(
            supabase.table("caregiver_applications").select("*"),
            "caregiver_applications",
        )
        .eq("caregiver_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not app_q.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No application found to resubmit.",
        )

    latest = app_q.data[0]
    if latest.get("status") != "rejected":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a rejected application can be resubmitted.",
        )

    # 2. Upsert caregiver profile
    profile_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone,
        "address": payload.address,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "ssn_last4": payload.ssn_last4,
    }
    profile_res = supabase.table("caregivers").upsert(profile_data).execute()
    if not profile_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update caregiver profile.",
        )

    # 3. Update users table state_id if needed
    (
        active_only(
            supabase.table("users").update({"state_id": payload.state_id}),
            "users",
        )
        .eq("id", user_id)
        .execute()
    )

    # 4. Flip the existing application record back to submitted (in-place resubmit)
    now_iso = datetime.now(timezone.utc).isoformat()
    app_res = (
        active_only(
            supabase.table("caregiver_applications").update({
                "state_id": payload.state_id,
                "status": "submitted",
                "submitted_at": now_iso,
                "notes": payload.notes,
                "rejection_reason": None,
                "reviewed_at": None,
                "reviewed_by": None,
                **signature,
            }),
            "caregiver_applications",
        )
        .eq("id", latest["id"])
        .execute()
    )

    if not app_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resubmit caregiver application.",
        )

    record_audit_log(
        supabase,
        user_id,
        "caregiver_application_signed",
        "caregiver_applications",
        latest["id"],
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
    )

    # 5. Create in-app notification
    notify(
        supabase,
        user_id,
        "application_resubmitted",
        "Application Resubmitted",
        "Your caregiver application has been resubmitted and is back under administrative review.",
    )

    return {
        "message": "Application resubmitted successfully",
        "application": app_res.data[0],
    }
