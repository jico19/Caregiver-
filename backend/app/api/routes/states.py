from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import validate_state
from app.core.supabase import get_supabase

router = APIRouter()


@router.get("/")
def list_states():
    supabase = get_supabase()
    res = supabase.table("states").select("*").eq("active", True).order("name").execute()
    return res.data


@router.get("/{state}")
def get_state(state: str = Depends(validate_state)):
    supabase = get_supabase()
    res = supabase.table("states").select("*").eq("slug", state).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="State not found")
    return res.data


@router.get("/{state}/services")
def get_state_services(state: str = Depends(validate_state)):
    supabase = get_supabase()
    state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
    if not state_row.data:
        raise HTTPException(status_code=404, detail="State not found")
    res = supabase.table("services").select("*").eq("state_id", state_row.data["id"]).eq("active", True).order("sort_order").execute()
    return {"state": state, "services": res.data}


@router.get("/{state}/forms")
def get_state_forms(state: str = Depends(validate_state)):
    supabase = get_supabase()
    state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
    if not state_row.data:
        raise HTTPException(status_code=404, detail="State not found")
    res = supabase.table("forms").select("*").eq("state_id", state_row.data["id"]).eq("active", True).order("sort_order").execute()
    return {"state": state, "forms": res.data}


@router.get("/{state}/licensing")
def get_state_licensing(state: str = Depends(validate_state)):
    supabase = get_supabase()
    state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
    if not state_row.data:
        raise HTTPException(status_code=404, detail="State not found")
    res = supabase.table("licensing_info").select("*").eq("state_id", state_row.data["id"]).eq("active", True).order("sort_order").execute()
    return {"state": state, "licensing": res.data}


@router.get("/{state}/careers")
def get_state_careers(state: str = Depends(validate_state)):
    supabase = get_supabase()
    state_row = supabase.table("states").select("id").eq("slug", state).single().execute()
    if not state_row.data:
        raise HTTPException(status_code=404, detail="State not found")
    res = (
        supabase.table("job_postings")
        .select("*")
        .eq("state_id", state_row.data["id"])
        .eq("active", True)
        .order("sort_order")
        .execute()
    )
    return {"state": state, "careers": res.data}



from pydantic import BaseModel, Field
from typing import Optional


class ContactInquiryRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    referral_source: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


@router.post("/{state}/contact")
def submit_contact_inquiry(
    payload: ContactInquiryRequest,
    state: str = Depends(validate_state),
):
    supabase = get_supabase()
    state_row = supabase.table("states").select("id, name").eq("slug", state).single().execute()
    if not state_row.data:
        raise HTTPException(status_code=404, detail="State not found")

    referral_data = {
        "state_id": state_row.data["id"],
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "phone": payload.phone.strip() if payload.phone else None,
        "email": payload.email.strip() if payload.email else None,
        "referral_source": payload.referral_source.strip() if payload.referral_source else "Website Inquiry",
        "notes": payload.notes.strip() if payload.notes else None,
        "status": "new",
    }

    res = supabase.table("client_referrals").insert(referral_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to record contact inquiry.")

    return {
        "message": f"Thank you! Your inquiry has been routed to our {state_row.data['name']} care coordinator.",
        "referral_id": res.data[0]["id"],
    }

