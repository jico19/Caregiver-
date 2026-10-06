"""Caregiver domain service: profile, applications, and roster data operations."""

from app.core.soft_delete import active_only


class CaregiverService:
    @staticmethod
    def get_caregiver_profile(supabase, caregiver_id: str):
        """Fetch active caregiver profile with state metadata."""
        res = (
            active_only(
                supabase.table("caregivers").select(
                    "id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4, created_at, updated_at, legal_hold, states(name, code, slug)"
                ),
                "caregivers",
            )
            .eq("id", caregiver_id)
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def get_latest_application(supabase, caregiver_id: str):
        """Fetch most recent active application for caregiver."""
        res = (
            active_only(
                supabase.table("caregiver_applications").select(
                    "id, caregiver_id, state_id, status, submitted_at, reviewed_at, reviewed_by, notes, rejection_reason, created_at, updated_at, states(name, code, slug)"
                ),
                "caregiver_applications",
            )
            .eq("caregiver_id", caregiver_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def get_active_assignments(supabase, caregiver_id: str):
        """Fetch active client assignments for caregiver."""
        res = (
            supabase.table("caregiver_client_assignments")
            .select("id, client_id, role, assigned_at, clients(id, first_name, last_name, phone, address, status, states(name, code, slug))")
            .eq("caregiver_id", caregiver_id)
            .is_("ended_at", None)
            .execute()
        )
        return res.data or []


caregiver_service = CaregiverService()
