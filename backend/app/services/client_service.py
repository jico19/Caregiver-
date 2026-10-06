"""Client domain service: profile, care plans, and agreements operations."""

from app.core.soft_delete import active_only


class ClientService:
    @staticmethod
    def get_client_profile(supabase, client_id: str):
        """Fetch active client profile with state metadata."""
        res = (
            active_only(
                supabase.table("clients").select(
                    "id, state_id, first_name, last_name, date_of_birth, phone, address, medicaid_number, status, service_start_date, admission_notes, rejection_reason, admitted_by, admitted_at, created_at, updated_at, legal_hold, states(name, code, slug)"
                ),
                "clients",
            )
            .eq("id", client_id)
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def get_care_plan(supabase, client_id: str):
        """Fetch active care plan for client."""
        res = (
            active_only(supabase.table("care_plans").select("*"), "care_plans")
            .eq("client_id", client_id)
            .single()
            .execute()
        )
        return res.data

    @staticmethod
    def get_schedules(supabase, client_id: str):
        """Fetch active care schedules for client."""
        res = (
            active_only(supabase.table("care_schedules").select("*"), "care_schedules")
            .eq("client_id", client_id)
            .execute()
        )
        return res.data or []


client_service = ClientService()
