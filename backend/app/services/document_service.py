import time
import re
from fastapi import HTTPException, status
from app.core.supabase import get_supabase
from app.utils.notifications import notify

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
STORAGE_BUCKET = "documents"


class DocumentService:
    @property
    def supabase(self):
        # Resolve lazily so reset_supabase() (reconnect fallback) takes effect.
        return get_supabase()

    def get_document_types(self, role: str | None = None):
        query = self.supabase.table("document_types").select("*")
        if role:
            query = query.in_("for_role", [role, "both"])
        res = query.order("name").execute()
        return res.data or []

    def get_user_documents(self, user_id: str):
        res = (
            self.supabase.table("documents")
            .select("*, document_types(name, for_role, requires_expiration)")
            .eq("owner_id", user_id)
            .order("uploaded_at", desc=True)
            .execute()
        )
        return res.data or []

    def upload_document(
        self,
        owner_id: str,
        role: str,
        state_id: int | None,
        document_type_id: int,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        expiration_date: str | None = None,
    ):
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{content_type}'. Allowed formats: PDF, JPEG, PNG.",
            )

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File exceeds maximum allowed size of 10 MB.",
            )

        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", original_filename)
        storage_path = f"{role}/{owner_id}/{document_type_id}_{int(time.time())}_{safe_name}"

        # Upload to Supabase Storage
        upload_res = self.supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )

        # Insert metadata into documents table
        doc_data = {
            "owner_id": owner_id,
            "document_type_id": document_type_id,
            "state_id": state_id,
            "storage_path": storage_path,
            "status": "pending_review",
            "expiration_date": expiration_date if expiration_date else None,
        }

        db_res = self.supabase.table("documents").insert(doc_data).execute()
        if not db_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register document record.",
            )

        doc_record = db_res.data[0]

        # In-app notification
        notify(
            self.supabase,
            owner_id,
            "document_uploaded",
            "Document Received",
            f"File '{original_filename}' uploaded successfully and queued for review.",
        )

        return doc_record

    def get_signed_url(self, document_id: str, requesting_user_id: str, is_admin: bool = False):
        res = (
            self.supabase.table("documents")
            .select("*")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        doc = res.data
        if not is_admin and doc["owner_id"] != requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access this document.",
            )

        signed_res = self.supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
            path=doc["storage_path"],
            expires_in=60,
        )

        return signed_res.get("signedURL") or signed_res.get("signedUrl")


document_service = DocumentService()
