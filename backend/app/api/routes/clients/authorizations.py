from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.core.dependencies import require_client
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase
from app.services.audit import record_audit_log
from app.services.document_service import document_service
from app.utils.notifications import notify

router = APIRouter()


@router.post("/me/authorizations")
async def upload_authorization(
    request: Request,
    file: UploadFile = File(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    notes: Optional[str] = Form(None),
    user: dict = Depends(require_client),
):
    """Client self-service: upload an authorization document -> pending authorization record."""
    supabase = get_supabase()
    user_id = user.get("sub")

    try:
        start_d = date.fromisoformat(start_date.strip())
        end_d = date.fromisoformat(end_date.strip())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start or end date.")
    if end_d < start_d:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after start date.")

    type_res = await run_in_threadpool(
        lambda: supabase.table("document_types")
        .select("id")
        .eq("name", "Authorization Document")
        .single()
        .execute()
    )
    if not type_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization Document type is not configured.",
        )

    file_bytes = await file.read()
    record = await run_in_threadpool(
        document_service.upload_document,
        owner_id=user_id,
        role="client",
        state_id=user.get("state_id"),
        document_type_id=type_res.data["id"],
        file_bytes=file_bytes,
        original_filename=file.filename or "authorization",
        content_type=file.content_type or "application/octet-stream",
        expiration_date=None,
    )

    doc_id = record.get("id", "")
    auth_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "authorization_number": f"PENDING-{doc_id[:8].upper()}",
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "status": "pending",
        "source": "client",
        "document_id": doc_id,
        "notes": notes.strip() if notes else "Submitted for authorization review.",
    }

    def _save_auth():
        auth_res = supabase.table("authorizations").insert(auth_data).execute()
        if not auth_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record authorization request.",
            )
        auth_id = auth_res.data[0]["id"]
        record_audit_log(
            supabase,
            user_id=user_id,
            action="authorization_uploaded",
            table_name="authorizations",
            record_id=str(auth_id),
            new_values=auth_data,
            request=request,
            entity_state_id=user.get("state_id"),
        )
        notify(
            supabase,
            user_id,
            "authorization_uploaded",
            "Authorization Submitted",
            "Your authorization document has been received and queued for care coordinator review.",
        )
        return auth_res.data[0]

    saved_auth = await run_in_threadpool(_save_auth)
    return {"message": "Authorization submitted for review", "authorization": saved_auth}


@router.get("/me/authorizations")
def get_my_authorizations(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("authorizations").select("*, states(name, code, slug)"),
            "authorizations",
        )
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
