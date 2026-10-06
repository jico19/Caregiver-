from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends

from app.core.dependencies import require_caregiver
from app.core.soft_delete import active_only
from app.core.supabase import get_supabase

router = APIRouter()


from app.schemas.documents import DocumentListResponse


def _parse_date(value) -> Optional[date]:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


@router.get("/me/documents", response_model=DocumentListResponse)
def get_my_documents(user: dict = Depends(require_caregiver)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        active_only(
            supabase.table("documents").select(
                "id, owner_id, document_type_id, state_id, storage_path, status, expiration_date, uploaded_at, document_types(name, requires_expiration)"
            ),
            "documents",
        )
        .eq("owner_id", user_id)
        .order("uploaded_at", desc=True)
        .execute()
    )

    return {"documents": res.data or []}


@router.get("/me/credential-status")
def get_credential_status(user: dict = Depends(require_caregiver)):
    """Aggregate credential health vs. the state's required document types."""
    supabase = get_supabase()
    user_id = user.get("sub")

    prof = (
        active_only(
            supabase.table("caregivers").select("state_id"),
            "caregivers",
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
            .select("document_type_id, required, document_types(name)")
            .eq("state_id", state_id)
            .execute()
        )
        required = req_res.data or []

    docs_res = (
        active_only(
            supabase.table("documents").select(
                "id, owner_id, state_id, document_type_id, status, expiration_date, uploaded_at, document_types(name, requires_expiration)"
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
