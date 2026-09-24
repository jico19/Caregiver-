from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, HTTPException
from starlette.concurrency import run_in_threadpool
from typing import Optional
from app.core.dependencies import get_current_user
from app.services.document_service import document_service, MAX_FILE_SIZE

router = APIRouter()


@router.get("/types")
def get_document_types(
    role: Optional[str] = Query(None, description="caregiver or client"),
    user: dict = Depends(get_current_user),
):
    types = document_service.get_document_types(role=role)
    return {"document_types": types}


@router.get("/me")
def get_my_documents(user: dict = Depends(get_current_user)):
    docs = document_service.get_user_documents(user_id=user["sub"])
    return {"documents": docs}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type_id: int = Form(...),
    expiration_date: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    # Reject oversized uploads before buffering the whole body into memory.
    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    file_bytes = await file.read(MAX_FILE_SIZE + 1)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    content_type = file.content_type or "application/octet-stream"

    # Supabase storage/DB calls are synchronous — run them off the event loop.
    record = await run_in_threadpool(
        document_service.upload_document,
        owner_id=user["sub"],
        role=user.get("role", "caregiver"),
        state_id=user.get("state_id"),
        document_type_id=document_type_id,
        file_bytes=file_bytes,
        original_filename=file.filename or "document",
        content_type=content_type,
        expiration_date=expiration_date,
    )

    return {
        "message": "Document uploaded successfully",
        "document": record,
    }


@router.get("/{document_id}/download-url")
def get_document_download_url(
    document_id: str,
    user: dict = Depends(get_current_user),
):
    is_admin = user.get("role") == "administrator"
    url = document_service.get_signed_url(
        document_id=document_id,
        requesting_user_id=user["sub"],
        is_admin=is_admin,
    )
    return {"download_url": url}