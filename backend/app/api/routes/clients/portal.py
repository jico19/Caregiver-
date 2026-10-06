from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.dependencies import require_client, validate_state_id
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase
from app.schemas.clients import ClientIntakeSubmit, ClientProfileUpdate
from app.services.audit import record_audit_log
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()


@router.get("/me")
def get_my_profile(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("clients").select(
                "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(name, code, slug)"
            ),
            "clients",
        )
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        return {"profile": None}

    return {"profile": res.data[0]}


@router.patch("/me/profile")
def update_my_profile(
    payload: ClientProfileUpdate,
    request: Request,
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

    res = (
        active_only(supabase.table("clients").update(update_data), "clients")
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found.")

    record_audit_log(
        supabase,
        user_id=user_id,
        action="client_profile_updated",
        table_name="clients",
        record_id=str(user_id),
        new_values=update_data,
        request=request,
        entity_state_id=user.get("state_id"),
    )

    return {"message": "Profile updated successfully", "profile": res.data[0]}


@router.post("/intake")
def submit_intake(
    payload: ClientIntakeSubmit,
    request: Request,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    signature = validate_signature(payload)
    validate_state_id(supabase, payload.state_id)

    client_data = {
        "id": user_id,
        "state_id": payload.state_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "date_of_birth": str(payload.date_of_birth) if payload.date_of_birth else None,
        "phone": payload.phone,
        "address": payload.address,
        "medicaid_number": payload.medicaid_number,
        **signature,
    }

    res = supabase.table("clients").upsert(client_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update client profile.",
        )

    supabase.table("users").update({"state_id": payload.state_id}).eq("id", user_id).execute()

    record_audit_log(
        supabase,
        user_id,
        "client_intake_signed",
        "clients",
        user_id,
        new_values={"signed_name": signature["signed_name"], "signed_at": signature["signed_at"]},
        request=request,
        required=True,
        entity_state_id=payload.state_id,
    )

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
