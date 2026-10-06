"""Data retention and compliance purge job.

Evaluates soft-deleted rows past statutory retention windows and permanently purges them
absent an active legal hold. Audit entries and client consent agreements are immutable and never purged.
"""
from datetime import datetime, timezone, timedelta
import logging
import os
from app.core.supabase import get_supabase
from app.services.audit import record_audit_log

logger = logging.getLogger(__name__)

# Retention intervals per table category (in days)
RETENTION_WINDOWS = {
    # Clinical (7 years)
    "care_plans": 7 * 365,
    "care_plan_activities": 7 * 365,
    "care_schedules": 7 * 365,
    # Financial & Billing (6 years)
    "authorizations": 6 * 365,
    "client_referrals": 6 * 365,
    # Workforce & Credentialing (5 years)
    "caregivers": 5 * 365,
    "caregiver_applications": 5 * 365,
    "documents": 5 * 365,
    "training_enrollments": 5 * 365,
    # Operational & Messaging (2 years)
    "announcements": 2 * 365,
    "notifications": 2 * 365,
}

# Tables with legal_hold flag immunity
LEGAL_HOLD_TABLES = {"clients", "caregivers", "documents"}

# Immutable tables that MUST NEVER BE PURGED
IMMUTABLE_PURGE_BLOCKED = {"audit_logs", "client_agreements"}


def run_retention_purge(supabase=None):
    if os.getenv("ENABLE_RETENTION_PURGE", "true").lower() == "false":
        logger.info("Retention purge job skipped (ENABLE_RETENTION_PURGE=false)")
        return {"status": "disabled", "purged": {}}

    if supabase is None:
        supabase = get_supabase()

    now = datetime.now(timezone.utc)
    summary = {}

    for table_name, retention_days in RETENTION_WINDOWS.items():
        if table_name in IMMUTABLE_PURGE_BLOCKED:
            continue

        cutoff_date = (now - timedelta(days=retention_days)).isoformat()

        # Query expired soft-deleted rows
        query = (
            supabase.table(table_name)
            .select("id, file_path" if table_name == "documents" else "id")
            .neq("deleted_at", None)
            .lt("deleted_at", cutoff_date)
        )

        if table_name in LEGAL_HOLD_TABLES:
            query = query.neq("legal_hold", True)

        res = query.execute()
        expired_rows = res.data or []
        if not expired_rows:
            summary[table_name] = 0
            continue

        expired_ids = [r["id"] for r in expired_rows]

        # Clean up Storage files for documents table
        if table_name == "documents":
            file_paths = [r["file_path"] for r in expired_rows if r.get("file_path")]
            if file_paths:
                try:
                    supabase.storage.from_("documents").remove(file_paths)
                except Exception as exc:
                    logger.warning("Failed to purge storage files for documents: %s", exc)

        # Permanent hard delete
        del_res = (
            supabase.table(table_name)
            .delete()
            .in_("id", expired_ids)
            .execute()
        )

        purged_count = len(del_res.data) if del_res.data else len(expired_ids)
        summary[table_name] = purged_count

        record_audit_log(
            supabase,
            user_id="system-retention-job",
            action="retention_purge_executed",
            table_name=table_name,
            record_id=f"batch-{table_name}",
            new_values={
                "purged_count": purged_count,
                "cutoff_timestamp": cutoff_date,
                "retention_days": retention_days,
            },
        )

    return {"status": "completed", "purged": summary}
