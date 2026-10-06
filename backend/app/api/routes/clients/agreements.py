import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.dependencies import require_client
from app.core.supabase import get_supabase
from app.schemas.clients import AgreementSignSubmit
from app.services.audit import record_audit_log
from app.services.signature_service import validate_signature
from app.utils.notifications import notify

router = APIRouter()

AGREEMENT_TEMPLATES = [
    {
        "agreement_key": "care_agreement",
        "title": "Care Agreement & Authorization for Services",
        "body": "I authorize the agency to provide home care services to the care recipient identified in my intake, including personal care, homemaking, and medication reminders as documented in the plan of care. I understand services are subject to authorization approval and that I may update my records at any time.",
    },
    {
        "agreement_key": "client_rights",
        "title": "Client Rights & Responsibilities",
        "body": "I acknowledge receipt of the program's client rights statement, including dignity and respect, confidentiality of health information, the right to be informed about services, and the right to voice grievances without retaliation.",
    },
]


@router.get("/me/agreements")
def get_my_agreements(user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")

    res = (
        supabase.table("client_agreements")
        .select("id, client_id, agreement_key, version, signed_at, signed_name, created_at, updated_at")
        .eq("client_id", user_id)
        .order("agreement_key")
        .execute()
    )
    signed = {a["agreement_key"]: a for a in res.data or []}

    items = []
    for tpl in AGREEMENT_TEMPLATES:
        record = signed.get(tpl["agreement_key"])
        items.append({
            **tpl,
            "signed": bool(record and record.get("signed_at")),
            "signed_at": record.get("signed_at") if record else None,
            "signed_name": record.get("signed_name") if record else None,
            "version": record.get("version") if record else 1,
        })

    return {"agreements": items}


@router.get("/me/agreements/{agreement_key}/history")
def get_agreement_history(agreement_key: str, user: dict = Depends(require_client)):
    supabase = get_supabase()
    user_id = user.get("sub")
    res = (
        supabase.table("client_agreements")
        .select("id, client_id, agreement_key, version, signed_at, signed_name, created_at, updated_at")
        .eq("client_id", user_id)
        .eq("agreement_key", agreement_key)
        .order("version", desc=True)
        .execute()
    )
    return {"history": res.data or []}


@router.post("/me/agreements/{agreement_key}/sign")
def sign_agreement(
    agreement_key: str,
    payload: AgreementSignSubmit,
    request: Request,
    user: dict = Depends(require_client),
):
    supabase = get_supabase()
    user_id = user.get("sub")

    tpl = next((t for t in AGREEMENT_TEMPLATES if t["agreement_key"] == agreement_key), None)
    if tpl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agreement not found.")

    signature = validate_signature(payload)

    # Determine version increment and compute content hash
    existing_res = (
        supabase.table("client_agreements")
        .select("version")
        .eq("client_id", user_id)
        .eq("agreement_key", agreement_key)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing_res.data[0]["version"] + 1) if existing_res.data and existing_res.data[0].get("version") else 1
    content_hash = hashlib.sha256(tpl["body"].encode("utf-8")).hexdigest()

    agreement_data = {
        "client_id": user_id,
        "state_id": user.get("state_id"),
        "agreement_key": agreement_key,
        "title": tpl["title"],
        "body": tpl["body"],
        "version": next_version,
        "content_hash": content_hash,
        **signature,
    }

    res = supabase.table("client_agreements").insert(agreement_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record agreement signature.",
        )

    record_audit_log(
        supabase,
        user_id,
        "client_agreement_signed",
        "client_agreements",
        agreement_key,
        new_values={
            "signed_name": signature["signed_name"],
            "signed_at": signature["signed_at"],
            "version": next_version,
            "content_hash": content_hash,
        },
        request=request,
        required=True,
        entity_state_id=user.get("state_id"),
    )

    notify(
        supabase,
        user_id,
        "agreement_signed",
        "Form Signed",
        f"'{tpl['title']}' has been signed electronically and stored on your record.",
    )

    return {"message": "Agreement signed successfully", "agreement": res.data[0]}
