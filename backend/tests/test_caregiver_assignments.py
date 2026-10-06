import pytest
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
