from datetime import datetime, timezone
from fastapi import HTTPException, status


def validate_signature(
    payload,
    empty_detail: str = "A drawn signature is required.",
    name_detail: str = "Your full name is required to sign.",
) -> dict:
    """Validate presence and format of drawn e-signature and signer name."""
    sig = (getattr(payload, "signature_data", None) or "").strip()
    name = (getattr(payload, "signed_name", None) or "").strip()
    if not sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=empty_detail,
        )
    if not sig.startswith("data:image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature must be a drawn image (data URL).",
        )
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=name_detail,
        )
    return {
        "signature_data": sig,
        "signed_name": name,
        "signed_at": datetime.now(timezone.utc).isoformat(),
    }
