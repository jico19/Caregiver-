"""Soft-deletion helpers.

The platform never hard-deletes a record that carries clinical, contractual, or
financial meaning. Instead a row is stamped with `deleted_at`/`deleted_by` and
every normal read path filters it out. Two tables are deliberately excluded:

- `audit_logs` and `client_agreements` are immutable evidence. They are never
  stamped and never filtered; `client_agreements` is versioned instead.

The set below is the single source of truth for which tables are soft-deletable.
Read paths must call `active_only()` rather than hand-rolling `.is_("deleted_at",
None)` so that adding a table here is the only edit required to extend coverage.
"""
from datetime import datetime, timezone

#: Tables that carry `deleted_at`/`deleted_by`. Excludes `audit_logs` and
#: `client_agreements` (immutable) and reference/config tables that are never
#: deleted, only deactivated through their own `active`/`status` column.
SOFT_DELETE_TABLES = frozenset({
    "users",
    "caregivers",
    "clients",
    "caregiver_applications",
    "documents",
    "notifications",
    "training_enrollments",
    "care_plans",
    "care_plan_activities",
    "care_schedules",
    "authorizations",
    "announcements",
    "client_referrals",
})

#: Tables that must never gain a `deleted_at` column.
IMMUTABLE_TABLES = frozenset({"audit_logs", "client_agreements"})


def active_only(query, table):
    """Restrict a PostgREST query builder to rows that are not soft-deleted.

    Raises if `table` is one of the immutable tables, because filtering them
    would silently hide signed agreements and audit evidence.
    """
    if table in IMMUTABLE_TABLES:
        raise ValueError(f"{table} is immutable and must not be soft-delete filtered")
    if table not in SOFT_DELETE_TABLES:
        raise ValueError(f"{table} is not a soft-delete table")
    return query.is_("deleted_at", None)


def exclude_deleted(rows):
    """Python-side safety net for rows already materialised without a filter.

    Rows written before the migration, and rows produced by a join, may not
    carry `deleted_at` in the selected column set. Treat a missing key as
    live, matching the SQL `deleted_at IS NULL` semantics.
    """
    return [row for row in (rows or []) if not (isinstance(row, dict) and row.get("deleted_at"))]


def trim_embedded(rows, *keys):
    """Drop embedded child objects that are soft-deleted.

    Required wherever a query embeds another soft-deletable table, e.g.
    `.select("*, caregivers(first_name, ...)")`. The backend uses the
    service-role client, which BYPASSES RLS, so the child table's own policy
    does not apply and a soft-deleted caregiver or user would otherwise be
    embedded into an admin list. The caller must add `deleted_at` to the
    embedded column list for this to work.

    PostgREST left-joins an embedded resource, so a missing child arrives as
    `None`; that is left untouched.
    """
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        for key in keys:
            child = row.get(key)
            if isinstance(child, dict) and child.get("deleted_at"):
                row[key] = None
    return rows


def soft_delete_stamp(actor_id):
    """Build the `deleted_at`/`deleted_by` payload for a soft delete."""
    return {
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "deleted_by": actor_id,
    }


def restore_stamp():
    """Build the payload that reverses a soft delete.

    Only the two columns created by the soft-deletion migration are touched.
    The reversal itself is recorded in `audit_logs`, which is immutable, so no
    `restored_at` column is required on every soft-deletable table.
    """
    return {"deleted_at": None, "deleted_by": None}
