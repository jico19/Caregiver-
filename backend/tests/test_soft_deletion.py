"""Soft deletion tests (Plan 001).

Verifies that:
- Rows are soft-deleted (deleted_at/deleted_by stamped), never destroyed.
- Normal read endpoints filter soft-deleted rows.
- Soft-deleted rows return 404 by ID.
- Soft-deleted clients are absent from stats and reports.
- Caregiver documents are hidden if the caregiver is soft-deleted.
- Re-enrolling after soft-delete succeeds.
- Care plan updates soft-delete activities, preserving history.
- Immutable tables (audit_logs, client_agreements) reject soft deletion.
- Restore is super_admin only, non-cascading, and audited.
"""
import pytest
from conftest import auth_headers
from app.core.soft_delete import (
    SOFT_DELETE_TABLES,
    IMMUTABLE_TABLES,
    active_only,
    soft_delete_stamp,
)


def seed_client(db, client_id="cl-1", state_id=1, deleted=False):
    row = {
        "id": client_id,
        "state_id": state_id,
        "first_name": "Alice",
        "last_name": "Smith",
        "created_at": "2026-09-01T00:00:00Z",
    }
    if deleted:
        row.update(soft_delete_stamp("u-admin"))
    db["clients"].append(row)
    return row


def seed_announcement(db, ann_id="ann-1", state_id=1, deleted=False):
    row = {
        "id": ann_id,
        "title": "Safety Alert",
        "body": "Wear masks.",
        "state_id": state_id,
        "audience": "all",
        "is_active": True,
        "created_at": "2026-09-01T00:00:00Z",
    }
    if deleted:
        row.update(soft_delete_stamp("u-admin"))
    db["announcements"].append(row)
    return row


# ---------- List & detail filtering ----------

def test_soft_deleted_client_absent_from_list_and_404_by_id(client):
    c, db, _ = client
    seed_client(db, "cl-live", deleted=False)
    seed_client(db, "cl-deleted", deleted=True)

    # List endpoint
    r = c.get("/api/v1/admin/clients", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    ids = [item["id"] for item in r.json()["clients"]]
    assert "cl-live" in ids
    assert "cl-deleted" not in ids

    # Detail endpoint: 404, not 403 or empty
    r_live = c.get("/api/v1/admin/clients/cl-live", headers=auth_headers("u-admin"))
    assert r_live.status_code == 200

    r_del = c.get("/api/v1/admin/clients/cl-deleted", headers=auth_headers("u-admin"))
    assert r_del.status_code == 404
    assert r_del.json()["detail"] == "Client not found."


def test_soft_deleted_announcement_absent_from_caregiver_and_admin_404(client):
    c, db, _ = client
    db["caregivers"].append({"id": "u-caregiver", "state_id": 1})
    seed_announcement(db, "ann-live", deleted=False)
    seed_announcement(db, "ann-del", deleted=True)

    # Caregiver list
    r = c.get("/api/v1/caregivers/me/announcements", headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    ann_ids = [a["id"] for a in r.json()["announcements"]]
    assert "ann-live" in ann_ids
    assert "ann-del" not in ann_ids

    # Admin delete on already-deleted returns 404
    r_del = c.delete("/api/v1/admin/announcements/ann-del", headers=auth_headers("u-admin"))
    assert r_del.status_code == 404


def test_soft_deleted_client_absent_from_dashboard_and_reports(client):
    c, db, _ = client
    seed_client(db, "cl-1", deleted=False)
    seed_client(db, "cl-2", deleted=True)
    db["authorizations"].append({
        "id": "auth-1", "client_id": "cl-1", "state_id": 1,
        "authorization_number": "AUTH-1", "start_date": "2026-01-01", "end_date": "2026-12-31",
        "status": "active",
    })
    auth_del = {
        "id": "auth-2", "client_id": "cl-2", "state_id": 1,
        "authorization_number": "AUTH-2", "start_date": "2026-01-01", "end_date": "2026-12-31",
        "status": "active",
    }
    auth_del.update(soft_delete_stamp("u-admin"))
    db["authorizations"].append(auth_del)

    # Stats dashboard: only live clients counted
    r_dash = c.get("/api/v1/admin/dashboard", headers=auth_headers("u-admin"))
    assert r_dash.status_code == 200
    assert r_dash.json()["metrics"]["total_clients"] == 1

    # Reports: client_authorizations row only includes live authorizations and live clients
    r_rep = c.get("/api/v1/admin/reports", headers=auth_headers("u-admin"))
    assert r_rep.status_code == 200
    report_auth_nums = [row["authorization_number"] for row in r_rep.json()["client_authorizations"]["rows"]]
    assert "AUTH-1" in report_auth_nums
    assert "AUTH-2" not in report_auth_nums


# ---------- Documents & signed URLs ----------

def test_soft_deleted_caregiver_documents_inaccessible(client):
    c, db, _ = client
    # Caregiver with soft-deleted user record
    db["users"].append({
        "id": "u-cg-deleted",
        "email": "cg.del@test.com",
        "role_id": 2,
        "state_id": 1,
        "roles": {"name": "caregiver"},
        "deleted_at": "2026-09-29T00:00:00Z",
    })
    db["caregiver_applications"].append({
        "id": "app-del",
        "caregiver_id": "u-cg-deleted",
        "state_id": 1,
        "status": "submitted",
    })
    db["documents"].append({
        "id": "doc-del",
        "owner_id": "u-cg-deleted",
        "state_id": 1,
        "document_type_id": 1,
        "storage_path": "caregiver/u-cg-deleted/1_file.pdf",
        "status": "approved",
    })

    # Signed URL check returns 404
    r_url = c.get("/api/v1/documents/doc-del/download-url", headers=auth_headers("u-admin"))
    assert r_url.status_code == 404

    # Admin caregiver documents list returns 404 because caregiver is soft-deleted
    r_docs = c.get("/api/v1/admin/caregivers/app-del/documents", headers=auth_headers("u-admin"))
    assert r_docs.status_code == 404

    # Admin all-documents list excludes soft-deleted owner
    r_all = c.get("/api/v1/admin/documents", headers=auth_headers("u-admin"))
    assert r_all.status_code == 200
    doc_ids = [d["id"] for d in r_all.json()["documents"]]
    assert "doc-del" not in doc_ids


# ---------- Re-enrollment & Re-upload ----------

def test_reenroll_caregiver_after_soft_deleted_enrollment(client):
    c, db, _ = client
    course_id = "course-1"
    db["training_courses"].append({
        "id": course_id, "name": "HIPAA Compliance", "state_id": None, "duration_hours": 2,
    })
    # Soft-deleted enrollment
    db["training_enrollments"].append({
        "id": "enr-old",
        "course_id": course_id,
        "caregiver_id": "u-caregiver",
        "status": "completed",
        "deleted_at": "2026-09-28T00:00:00Z",
    })

    # Re-enrolling succeeds and creates a new live enrollment
    r = c.post(f"/api/v1/training/courses/{course_id}/enroll", headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    assert r.json()["message"] == "Enrolled successfully"
    new_enr = r.json()["enrollment"]
    assert new_enr["id"] != "enr-old"
    assert new_enr["status"] == "in_progress"


# ---------- Care plan activity history preservation ----------

def test_editing_care_plan_preserves_previous_activity_rows(client):
    c, db, _ = client
    seed_client(db, "u-client", state_id=1)
    db["care_plans"].append({
        "id": "plan-1",
        "client_id": "u-client",
        "state_id": 1,
        "status": "active",
        "created_by": "u-admin",
    })
    db["care_plan_activities"].extend([
        {"id": "act-old-1", "care_plan_id": "plan-1", "task": "Old Task 1", "sort_order": 1},
        {"id": "act-old-2", "care_plan_id": "plan-1", "task": "Old Task 2", "sort_order": 2},
    ])

    # Update care plan with new activity
    payload = {
        "status": "active",
        "primary_nurse": "Nurse Joy",
        "emergency_protocol": "Call 911",
        "activities": [{"task": "New Replacement Task", "sort_order": 1}],
    }
    r = c.put("/api/v1/admin/clients/u-client/care-plan", json=payload, headers=auth_headers("u-admin"))
    assert r.status_code == 200

    # The old activity rows MUST still exist in the database with deleted_at set!
    old_1 = next(a for a in db["care_plan_activities"] if a["id"] == "act-old-1")
    old_2 = next(a for a in db["care_plan_activities"] if a["id"] == "act-old-2")
    assert old_1.get("deleted_at") is not None
    assert old_1.get("deleted_by") == "u-admin"
    assert old_2.get("deleted_at") is not None

    # The GET response only returns the active new activity
    activities = r.json()["care_plan"]["activities"]
    assert len(activities) == 1
    assert activities[0]["task"] == "New Replacement Task"


def test_delete_schedule_stamps_deleted_at(client):
    c, db, _ = client
    seed_client(db, "u-client", state_id=1)
    db["care_schedules"].append({
        "id": "sched-1",
        "client_id": "u-client",
        "state_id": 1,
        "day_of_week": "Monday",
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "service": "Personal Care",
        "status": "scheduled",
    })

    # Delete schedule
    r = c.delete("/api/v1/admin/clients/u-client/schedule/sched-1", headers=auth_headers("u-admin"))
    assert r.status_code == 200

    # Row is preserved in database with deleted_at set
    sched_row = next(s for s in db["care_schedules"] if s["id"] == "sched-1")
    assert sched_row.get("deleted_at") is not None
    assert sched_row.get("deleted_by") == "u-admin"

    # GET schedule no longer returns it
    r_get = c.get("/api/v1/admin/clients/u-client/schedule", headers=auth_headers("u-admin"))
    assert r_get.status_code == 200
    assert len(r_get.json()["schedule"]) == 0


# ---------- Immutability of audit_logs and client_agreements ----------

def test_immutable_tables_reject_soft_delete(client):
    c, db, _ = client
    # active_only helper raises on immutable tables
    with pytest.raises(ValueError, match="is immutable"):
        active_only(None, "audit_logs")

    with pytest.raises(ValueError, match="is immutable"):
        active_only(None, "client_agreements")

    # Restore endpoint rejects immutable tables
    r = c.post("/api/v1/admin/audit_logs/123/restore", headers=auth_headers("u-admin"))
    assert r.status_code == 400
    assert "immutable" in r.json()["detail"]

    r_agr = c.post("/api/v1/admin/client_agreements/123/restore", headers=auth_headers("u-admin"))
    assert r_agr.status_code == 400
    assert "immutable" in r_agr.json()["detail"]


# ---------- Restore path (super_admin only, non-cascading, audited) ----------

def test_restore_state_admin_forbidden_super_admin_allowed(client):
    c, db, _ = client
    seed_client(db, "cl-res", deleted=True)

    # State admin forbidden (403)
    r_state = c.post("/api/v1/admin/clients/cl-res/restore", headers=auth_headers("u-admin-fl"))
    assert r_state.status_code == 403

    # Super admin allowed (200)
    r_super = c.post("/api/v1/admin/clients/cl-res/restore", headers=auth_headers("u-admin"))
    assert r_super.status_code == 200
    assert r_super.json()["message"] == "clients restored successfully"

    # Client is now live again
    cl_row = next(r for r in db["clients"] if r["id"] == "cl-res")
    assert cl_row.get("deleted_at") is None
    assert cl_row.get("deleted_by") is None

    # Audit log was written
    audit_entry = next(
        a for a in db.get("audit_logs", [])
        if a.get("table_name") == "clients" and a.get("action") == "clients_restored"
    )
    assert audit_entry["record_id"] == "cl-res"
    assert audit_entry["user_id"] == "u-admin"


def test_restore_is_non_cascading(client):
    c, db, _ = client
    seed_client(db, "cl-cascade", deleted=True)
    db["care_plans"].append({
        "id": "plan-cascade",
        "client_id": "cl-cascade",
        "state_id": 1,
        "status": "active",
        "deleted_at": "2026-09-29T00:00:00Z",
    })

    # Restore the client only
    r = c.post("/api/v1/admin/clients/cl-cascade/restore", headers=auth_headers("u-admin"))
    assert r.status_code == 200

    # Client is live
    r_client = c.get("/api/v1/admin/clients/cl-cascade", headers=auth_headers("u-admin"))
    assert r_client.status_code == 200

    # But care plan remains soft-deleted (returns None)
    r_plan = c.get("/api/v1/admin/clients/cl-cascade/care-plan", headers=auth_headers("u-admin"))
    assert r_plan.status_code == 200
    assert r_plan.json()["care_plan"] is None

    # Deliberately restoring the care plan revives it
    r_res_plan = c.post("/api/v1/admin/care-plans/plan-cascade/restore", headers=auth_headers("u-admin"))
    assert r_res_plan.status_code == 200

    r_plan_revived = c.get("/api/v1/admin/clients/cl-cascade/care-plan", headers=auth_headers("u-admin"))
    assert r_plan_revived.status_code == 200
    assert r_plan_revived.json()["care_plan"]["id"] == "plan-cascade"


def test_restore_user_sets_active_status(client):
    c, db, _ = client
    db["users"].append({
        "id": "u-restored",
        "email": "restored@test.com",
        "role_id": 1,
        "state_id": 1,
        "status": "suspended",
        "deleted_at": "2026-09-28T00:00:00Z",
    })

    r = c.post("/api/v1/admin/users/u-restored/restore", headers=auth_headers("u-admin"))
    assert r.status_code == 200

    user_row = next(u for u in db["users"] if u["id"] == "u-restored")
    assert user_row.get("deleted_at") is None
    assert user_row.get("status") == "active"
