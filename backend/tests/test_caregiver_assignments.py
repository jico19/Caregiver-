import pytest
from datetime import date, timedelta
from conftest import auth_headers


def test_caregiver_assigned_client_visibility(client):
    c, db, _ = client

    db["caregivers"].append({
        "id": "u-caregiver",
        "state_id": 1,
        "first_name": "Jane",
        "last_name": "Doe",
        "phone": "555-0199",
    })
    db["clients"].append({
        "id": "c-1",
        "state_id": 1,
        "first_name": "Alice",
        "last_name": "Smith",
        "phone": "555-0100",
        "status": "active",
    })
    db["caregiver_client_assignments"].append({
        "id": "asgn-1",
        "caregiver_id": "u-caregiver",
        "client_id": "c-1",
        "role": "primary",
        "assigned_by": "u-admin-fl",
        "assigned_at": "2026-09-29T10:00:00Z",
        "ended_at": None,
    })
    db["care_plans"].append({
        "id": "cp-1",
        "client_id": "c-1",
        "status": "active",
        "primary_nurse": "Nurse Joy",
        "effective_date": "2026-01-01",
        "emergency_protocol": "Call 911",
    })
    db["care_plan_activities"].append({
        "id": "cpa-1",
        "care_plan_id": "cp-1",
        "task": "Morning Medication",
        "frequency": "Daily",
        "notes": "With water",
        "sort_order": 1,
    })
    db["care_schedules"].append({
        "id": "cs-1",
        "client_id": "c-1",
        "day_of_week": "Monday",
        "start_time": "09:00",
        "end_time": "12:00",
        "service": "Personal Care",
        "status": "scheduled",
    })

    # 1. Roster
    res = c.get("/api/v1/caregivers/me/clients", headers=auth_headers("u-caregiver"))
    assert res.status_code == 200
    clients_list = res.json()["clients"]
    assert len(clients_list) == 1
    assert clients_list[0]["id"] == "c-1"

    # 2. Read-only Care Plan
    res = c.get("/api/v1/caregivers/me/clients/c-1/care-plan", headers=auth_headers("u-caregiver"))
    assert res.status_code == 200
    data = res.json()
    assert data["care_plan"]["client_name"] == "Alice Smith"
    assert len(data["care_plan"]["daily_activities"]) == 1

    # 3. Read-only Schedule
    res = c.get("/api/v1/caregivers/me/clients/c-1/schedule", headers=auth_headers("u-caregiver"))
    assert res.status_code == 200
    sched = res.json()["schedule"]
    assert len(sched) == 1
    assert sched[0]["day_of_week"] == "Monday"


def test_caregiver_unassigned_client_denied(client):
    c, db, _ = client

    db["caregivers"].append({"id": "u-caregiver", "state_id": 1})
    db["clients"].append({"id": "c-unassigned", "state_id": 1, "first_name": "Bob", "last_name": "Brown"})

    # Roster does not include unassigned client
    res = c.get("/api/v1/caregivers/me/clients", headers=auth_headers("u-caregiver"))
    assert res.status_code == 200
    assert len(res.json()["clients"]) == 0

    # Care plan read denied
    res = c.get("/api/v1/caregivers/me/clients/c-unassigned/care-plan", headers=auth_headers("u-caregiver"))
    assert res.status_code == 403

    # Schedule read denied
    res = c.get("/api/v1/caregivers/me/clients/c-unassigned/schedule", headers=auth_headers("u-caregiver"))
    assert res.status_code == 403


def test_ended_assignment_not_returned(client):
    c, db, _ = client

    db["caregivers"].append({"id": "u-caregiver", "state_id": 1})
    db["clients"].append({"id": "c-ended", "state_id": 1})
    db["caregiver_client_assignments"].append({
        "id": "asgn-ended",
        "caregiver_id": "u-caregiver",
        "client_id": "c-ended",
        "role": "primary",
        "assigned_by": "u-admin-fl",
        "assigned_at": "2026-01-01T00:00:00Z",
        "ended_at": "2026-06-01T00:00:00Z",
    })

    res = c.get("/api/v1/caregivers/me/clients", headers=auth_headers("u-caregiver"))
    assert res.status_code == 200
    assert len(res.json()["clients"]) == 0

    res = c.get("/api/v1/caregivers/me/clients/c-ended/care-plan", headers=auth_headers("u-caregiver"))
    assert res.status_code == 403


def test_admin_assignment_and_state_scoping(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-fl", "state_id": 1})
    db["caregivers"].append({"id": "cg-in", "state_id": 2})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["clients"].append({"id": "client-in", "state_id": 2})

    # FL admin assigns FL caregiver to FL client -> 200
    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-fl", "role": "primary"},
    )
    assert res.status_code == 200
    assert len(db["caregiver_client_assignments"]) == 1
    assert any(log["action"] == "caregiver_client_assigned" for log in db["audit_logs"])

    # FL admin cannot assign to IN client -> 403
    res = c.post(
        "/api/v1/admin/clients/client-in/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-in", "role": "primary"},
    )
    assert res.status_code == 403

    # Super admin can assign in IN -> 200
    res = c.post(
        "/api/v1/admin/clients/client-in/assignments",
        headers=auth_headers("u-admin"),
        json={"caregiver_id": "cg-in", "role": "backup"},
    )
    assert res.status_code == 200

    # End assignment
    res = c.delete(
        "/api/v1/admin/clients/client-fl/assignments/cg-fl",
        headers=auth_headers("u-admin-fl"),
    )
    assert res.status_code == 200
    assert any(log["action"] == "caregiver_client_assignment_ended" for log in db["audit_logs"])

    # History preserved in DB
    asg = [a for a in db["caregiver_client_assignments"] if a["client_id"] == "client-fl"][0]
    assert asg["ended_at"] is not None


def test_caregiver_assignments_not_found(client):
    c, db, _ = client
    db["clients"].append({"id": "client-fl", "state_id": 1})

    # Non-existent caregiver assignments returns 404, not 500
    res = c.get(
        "/api/v1/admin/caregivers/9088ba37-80c6-4b9d-8b01-d8529b7febc1/assignments",
        headers=auth_headers("u-admin"),
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Caregiver not found."

    # Assigning non-existent caregiver returns 404
    res_assign = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "9088ba37-80c6-4b9d-8b01-d8529b7febc1", "role": "primary"},
    )
    assert res_assign.status_code == 404
    assert res_assign.json()["detail"] == "Caregiver not found."


def test_caregiver_assignments_resolved_via_application_id(client):
    c, db, _ = client
    # Application exists with caregiver_id pointing to u-caregiver
    db["caregiver_applications"].append({
        "id": "app-9088ba37",
        "caregiver_id": "u-caregiver",
        "state_id": 1,
        "status": "submitted",
    })
    db["caregivers"].append({"id": "u-caregiver", "state_id": 1})

    # Calling assignments endpoint with application_id resolves to u-caregiver and returns 200
    res = c.get(
        "/api/v1/admin/caregivers/app-9088ba37/assignments",
        headers=auth_headers("u-admin"),
    )
    assert res.status_code == 200
    assert res.json() == {"assignments": []}


def test_assignment_blocked_for_expired_cpr_certificate(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-expired", "state_id": 1, "first_name": "John", "last_name": "Doe"})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    # Caregiver has CPR, but it expired yesterday
    db["documents"].append({
        "id": "doc-cpr-exp",
        "owner_id": "cg-expired",
        "document_type_id": 10,
        "state_id": 1,
        "status": "approved",
        "expiration_date": (today - timedelta(days=1)).isoformat(),
    })

    # Admin attempt to assign should fail with 422
    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-expired", "role": "primary"},
    )
    assert res.status_code == 422
    assert "CPR Certification" in res.json()["detail"]
    assert "Expired" in res.json()["detail"]


def test_assignment_blocked_for_missing_required_document(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-missing", "state_id": 1, "first_name": "Jane", "last_name": "Smith"})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({
        "id": 11,
        "name": "TB Test",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 11,
        "required": True,
        "for_role": "caregiver",
    })

    # No document uploaded
    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-missing", "role": "primary"},
    )
    assert res.status_code == 422
    assert "Missing required document" in res.json()["detail"]
    assert "TB Test" in res.json()["detail"]


def test_assignment_succeeds_for_compliant_caregiver(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-compliant", "state_id": 1, "first_name": "Compliant", "last_name": "Caregiver"})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    # Valid CPR valid for 1 year
    db["documents"].append({
        "id": "doc-cpr-valid",
        "owner_id": "cg-compliant",
        "document_type_id": 10,
        "state_id": 1,
        "status": "approved",
        "expiration_date": (today + timedelta(days=365)).isoformat(),
    })

    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-compliant", "role": "primary"},
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Caregiver assigned successfully"


def test_compliance_override_by_regular_admin_denied(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-exp", "state_id": 1})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({"id": 10, "name": "CPR Certification", "for_role": "caregiver"})
    db["document_requirements"].append({"state_id": 1, "document_type_id": 10, "required": True})
    db["documents"].append({
        "id": "doc-1",
        "owner_id": "cg-exp",
        "document_type_id": 10,
        "state_id": 1,
        "status": "expired",
    })

    # Scoped admin attempts override -> 403 Forbidden
    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin-fl"),
        json={
            "caregiver_id": "cg-exp",
            "role": "primary",
            "override_compliance": True,
            "override_reason": "Emergency staffing",
        },
    )
    assert res.status_code == 403
    assert "Only super administrators can override" in res.json()["detail"]


def test_compliance_override_by_super_admin_requires_reason(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-exp", "state_id": 1})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({"id": 10, "name": "CPR Certification", "for_role": "caregiver"})
    db["document_requirements"].append({"state_id": 1, "document_type_id": 10, "required": True})

    # Super admin attempts override without reason -> 422 Unprocessable Entity
    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin"),
        json={
            "caregiver_id": "cg-exp",
            "role": "primary",
            "override_compliance": True,
            "override_reason": "   ",
        },
    )
    assert res.status_code == 422
    assert "override reason is required" in res.json()["detail"].lower()


def test_compliance_override_by_super_admin_succeeds_and_audits(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-exp", "state_id": 1})
    db["clients"].append({"id": "client-fl", "state_id": 1})
    db["document_types"].append({"id": 10, "name": "CPR Certification", "for_role": "caregiver"})
    db["document_requirements"].append({"state_id": 1, "document_type_id": 10, "required": True})

    res = c.post(
        "/api/v1/admin/clients/client-fl/assignments",
        headers=auth_headers("u-admin"),
        json={
            "caregiver_id": "cg-exp",
            "role": "primary",
            "override_compliance": True,
            "override_reason": "Executive director emergency authorization for immediate client safety",
        },
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Caregiver assigned successfully"

    # Verify audit log stamped with override justification
    logs = [l for l in db["audit_logs"] if l["action"] == "caregiver_client_assigned"]
    assert len(logs) == 1
    assert logs[0]["new_values"]["compliance_override"] is True
    assert logs[0]["new_values"]["override_reason"] == "Executive director emergency authorization for immediate client safety"
    assert len(logs[0]["new_values"]["blocking_reasons"]) > 0

    override_logs = [l for l in db["audit_logs"] if l["action"] == "caregiver_compliance_override"]
    assert len(override_logs) == 1
    assert override_logs[0]["new_values"]["override_reason"] == "Executive director emergency authorization for immediate client safety"


def test_caregiver_compliance_endpoint(client):
    c, db, _ = client

    db["caregivers"].append({"id": "cg-check", "state_id": 1})
    db["document_types"].append({"id": 10, "name": "CPR Certification", "for_role": "caregiver"})
    db["document_requirements"].append({"state_id": 1, "document_type_id": 10, "required": True})
    db["documents"].append({
        "id": "doc-exp",
        "owner_id": "cg-check",
        "document_type_id": 10,
        "state_id": 1,
        "status": "expired",
    })

    res = c.get(
        "/api/v1/admin/caregivers/cg-check/compliance",
        headers=auth_headers("u-admin-fl"),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["compliant"] is False
    assert data["status"] == "Credentials Expired"
    assert len(data["blocking_reasons"]) == 1


def test_assignment_valid_renewal_supersedes_expired_document(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-renewal", "state_id": 1, "first_name": "Renewed", "last_name": "Worker"})
    db["clients"].append({"id": "client-fl-1", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    # Older expired CPR
    db["documents"].append({
        "id": "doc-cpr-old",
        "owner_id": "cg-renewal",
        "document_type_id": 10,
        "state_id": 1,
        "status": "expired",
        "expiration_date": (today - timedelta(days=30)).isoformat(),
    })
    # Newer valid renewal
    db["documents"].append({
        "id": "doc-cpr-new",
        "owner_id": "cg-renewal",
        "document_type_id": 10,
        "state_id": 1,
        "status": "approved",
        "expiration_date": (today + timedelta(days=365)).isoformat(),
    })

    res = c.post(
        "/api/v1/admin/clients/client-fl-1/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-renewal", "role": "primary"},
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Caregiver assigned successfully"


def test_assignment_latest_expiration_date_reported_when_multiple_expired(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-multi-exp", "state_id": 1})
    db["clients"].append({"id": "client-fl-2", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    # Older expired CPR (expired 2 years ago)
    db["documents"].append({
        "id": "doc-cpr-2yr",
        "owner_id": "cg-multi-exp",
        "document_type_id": 10,
        "state_id": 1,
        "status": "expired",
        "expiration_date": (today - timedelta(days=730)).isoformat(),
    })
    # Recent expired CPR (expired 5 days ago)
    recent_exp = today - timedelta(days=5)
    db["documents"].append({
        "id": "doc-cpr-recent",
        "owner_id": "cg-multi-exp",
        "document_type_id": 10,
        "state_id": 1,
        "status": "expired",
        "expiration_date": recent_exp.isoformat(),
    })

    res = c.post(
        "/api/v1/admin/clients/client-fl-2/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-multi-exp", "role": "primary"},
    )
    assert res.status_code == 422
    # Should report the more recent expiration date, not the 2-year-old one
    assert recent_exp.isoformat() in res.json()["detail"]


def test_assignment_cross_state_documents_do_not_block_compliance(client):
    c, db, _ = client
    today = date.today()

    # Caregiver in State 1 (FL)
    db["caregivers"].append({"id": "cg-fl-worker", "state_id": 1})
    db["clients"].append({"id": "client-fl-3", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_types"].append({
        "id": 20,
        "name": "Georgia State License",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    # State 1 only requires CPR
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    # State 3 (GA) requires GA State License
    db["document_requirements"].append({
        "state_id": 3,
        "document_type_id": 20,
        "required": True,
        "for_role": "caregiver",
    })
    # Caregiver has valid CPR in FL (state_id=1)
    db["documents"].append({
        "id": "doc-fl-cpr",
        "owner_id": "cg-fl-worker",
        "document_type_id": 10,
        "state_id": 1,
        "status": "approved",
        "expiration_date": (today + timedelta(days=100)).isoformat(),
    })
    # Caregiver has an expired GA License from state_id=3
    db["documents"].append({
        "id": "doc-ga-lic",
        "owner_id": "cg-fl-worker",
        "document_type_id": 20,
        "state_id": 3,
        "status": "expired",
        "expiration_date": (today - timedelta(days=10)).isoformat(),
    })

    # In FL, assignment must succeed because the expired GA license belongs to GA
    res = c.post(
        "/api/v1/admin/clients/client-fl-3/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-fl-worker", "role": "primary"},
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Caregiver assigned successfully"


def test_assignment_caregiver_client_state_mismatch_rejected(client):
    c, db, _ = client

    # Caregiver in FL (1), Client in IN (2)
    db["caregivers"].append({"id": "cg-fl-only", "state_id": 1})
    db["clients"].append({"id": "client-in-only", "state_id": 2})

    # Super admin attempts to assign FL caregiver to IN client
    res = c.post(
        "/api/v1/admin/clients/client-in-only/assignments",
        headers=auth_headers("u-admin"),
        json={"caregiver_id": "cg-fl-only", "role": "primary"},
    )
    assert res.status_code == 422
    assert "does not belong to the same state" in res.json()["detail"].lower() or "state" in res.json()["detail"].lower()


def test_assignment_via_application_id_resolves_and_validates(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-resolved", "state_id": 1})
    db["caregiver_applications"].append({
        "id": "app-resolve-1",
        "caregiver_id": "cg-resolved",
        "state_id": 1,
        "status": "approved",
    })
    db["clients"].append({"id": "client-fl-app", "state_id": 1})
    db["document_types"].append({
        "id": 10,
        "name": "CPR Certification",
        "for_role": "caregiver",
        "requires_expiration": True,
    })
    db["document_requirements"].append({
        "state_id": 1,
        "document_type_id": 10,
        "required": True,
        "for_role": "caregiver",
    })
    db["documents"].append({
        "id": "doc-cpr-res",
        "owner_id": "cg-resolved",
        "document_type_id": 10,
        "state_id": 1,
        "status": "approved",
        "expiration_date": (today + timedelta(days=180)).isoformat(),
    })

    # Passing application ID to assignments endpoint resolves to caregiver and assigns successfully
    res = c.post(
        "/api/v1/admin/clients/client-fl-app/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "app-resolve-1", "role": "primary"},
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Caregiver assigned successfully"
    # Foreign key stored is real caregiver ID
    assert res.json()["assignment"]["caregiver_id"] == "cg-resolved"


def test_compliance_skips_client_role_document_types(client):
    c, db, _ = client
    today = date.today()

    db["caregivers"].append({"id": "cg-client-doc", "state_id": 1})
    db["clients"].append({"id": "client-fl-cd", "state_id": 1})
    db["document_types"].append({
        "id": 99,
        "name": "Client Plan of Care",
        "for_role": "client",
        "requires_expiration": True,
    })
    # Caregiver has an expired client-role document attached
    db["documents"].append({
        "id": "doc-client-exp",
        "owner_id": "cg-client-doc",
        "document_type_id": 99,
        "state_id": 1,
        "status": "expired",
        "expiration_date": (today - timedelta(days=10)).isoformat(),
    })

    # Should be compliant for caregiver assignment since document is for client role
    res = c.post(
        "/api/v1/admin/clients/client-fl-cd/assignments",
        headers=auth_headers("u-admin-fl"),
        json={"caregiver_id": "cg-client-doc", "role": "primary"},
    )
    assert res.status_code == 200

