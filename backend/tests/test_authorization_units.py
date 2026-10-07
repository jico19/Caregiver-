"""Tests for Authorization units, HCPCS codes, burn-down calculations, and weekly caps."""
import pytest
from conftest import auth_headers


def test_create_authorization_with_units_and_hcpcs(client):
    c, db, _ = client
    # Seed client
    db["clients"].append({
        "id": "cl-1",
        "first_name": "Eleanor",
        "last_name": "Vance",
        "state_id": 1,
        "medicaid_number": "FL-MED-9999",
    })

    payload = {
        "client_id": "cl-1",
        "state_id": 1,
        "authorization_number": "AUTH-2026-T1019-01",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "notes": "Personal Care 30 hrs/wk",
        "hcpcs_code": "T1019",
        "service_description": "Personal Care Services",
        "total_units_authorized": 120,
        "units_used": 20,
        "max_weekly_hours": 30.0,
        "unit_type": "15_min",
    }

    r = c.post(
        "/api/v1/admin/authorizations",
        json=payload,
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200, r.text
    data = r.json()["authorization"]
    assert data["hcpcs_code"] == "T1019"
    assert data["service_description"] == "Personal Care Services"
    assert data["total_units_authorized"] == 120
    assert data["units_used"] == 20
    assert data["units_remaining"] == 100
    assert data["total_hours"] == 30.0
    assert data["hours_used"] == 5.0
    assert data["remaining_hours"] == 25.0
    assert data["max_weekly_hours"] == 30.0
    assert data["unit_type"] == "15_min"


def test_admin_list_authorizations_computes_remaining(client):
    c, db, _ = client
    db["clients"].append({
        "id": "cl-1",
        "first_name": "Eleanor",
        "last_name": "Vance",
        "state_id": 1,
        "deleted_at": None,
    })
    db["authorizations"].append({
        "id": "auth-100",
        "client_id": "cl-1",
        "state_id": 1,
        "authorization_number": "AUTH-TEST-100",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active",
        "notes": "Attendant Care",
        "hcpcs_code": "S5125",
        "service_description": "Attendant Care",
        "total_units_authorized": 200,
        "units_used": 80,
        "max_weekly_hours": 25.0,
        "unit_type": "15_min",
        "created_at": "2026-01-01T00:00:00Z",
    })

    r = c.get("/api/v1/admin/authorizations", headers=auth_headers("u-admin"))
    assert r.status_code == 200, r.text
    items = r.json()["authorizations"]
    assert len(items) >= 1
    found = next(a for a in items if a["id"] == "auth-100")
    assert found["hcpcs_code"] == "S5125"
    assert found["total_units_authorized"] == 200
    assert found["units_used"] == 80
    assert found["units_remaining"] == 120
    assert found["remaining_hours"] == 30.0
    assert found["total_hours"] == 50.0
    assert found["hours_used"] == 20.0


def test_client_portal_authorizations_returns_care_allowance(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-client-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "AUTH-CLI-1",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active",
        "source": "admin",
        "hcpcs_code": "T1019",
        "service_description": "Personal Care Services",
        "total_units_authorized": 160,
        "units_used": 40,
        "max_weekly_hours": 20.0,
        "unit_type": "15_min",
    })

    r = c.get("/api/v1/clients/me/authorizations", headers=auth_headers("u-client"))
    assert r.status_code == 200, r.text
    records = r.json()["authorizations"]
    assert len(records) >= 1
    rec = next(a for a in records if a["id"] == "auth-client-1")
    assert rec["total_units_authorized"] == 160
    assert rec["units_used"] == 40
    assert rec["units_remaining"] == 120
    assert rec["total_hours"] == 40.0
    assert rec["hours_used"] == 10.0
    assert rec["remaining_hours"] == 30.0
    assert rec["max_weekly_hours"] == 20.0
    assert rec["hcpcs_code"] == "T1019"


def test_admin_review_sets_procedure_code_and_units(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-rev-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "PENDING-REV-1",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "pending",
        "source": "client",
        "document_id": "doc-rev-1",
        "notes": "Please approve",
    })
    db["documents"].append({
        "id": "doc-rev-1",
        "owner_id": "u-client",
        "document_type_id": 1,
        "status": "pending_review",
    })

    review_payload = {
        "status": "approved",
        "notes": "Approved per state determination letter",
        "hcpcs_code": "S5125",
        "service_description": "Attendant Care Services",
        "total_units_authorized": 80,
        "units_used": 0,
        "max_weekly_hours": 20.0,
        "unit_type": "15_min",
    }

    r = c.post(
        "/api/v1/admin/authorizations/auth-rev-1/review",
        json=review_payload,
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200, r.text
    auth = r.json()["authorization"]
    assert auth["status"] == "active"
    assert auth["hcpcs_code"] == "S5125"
    assert auth["total_units_authorized"] == 80
    assert auth["units_used"] == 0
    assert auth["units_remaining"] == 80
    assert auth["remaining_hours"] == 20.0


def test_admin_update_authorization_units(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-upd-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "AUTH-UPD-1",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active",
        "hcpcs_code": "T1019",
        "total_units_authorized": 100,
        "units_used": 10,
        "unit_type": "15_min",
    })

    # Update units used from 10 to 30
    r = c.patch(
        "/api/v1/admin/authorizations/auth-upd-1",
        json={"units_used": 30, "max_weekly_hours": 15.0},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200, r.text
    auth = r.json()["authorization"]
    assert auth["units_used"] == 30
    assert auth["units_remaining"] == 70
    assert auth["remaining_hours"] == 17.5
    assert auth["max_weekly_hours"] == 15.0


def test_hourly_unit_type_calculation(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-hr-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "AUTH-HR-1",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active",
        "hcpcs_code": "T1000",
        "total_units_authorized": 50,
        "units_used": 15,
        "unit_type": "hourly",
    })

    r = c.get("/api/v1/clients/me/authorizations", headers=auth_headers("u-client"))
    assert r.status_code == 200
    rec = next(a for a in r.json()["authorizations"] if a["id"] == "auth-hr-1")
    assert rec["unit_type"] == "hourly"
    assert rec["units_remaining"] == 35
    assert rec["remaining_hours"] == 35.0
    assert rec["total_hours"] == 50.0
    assert rec["hours_used"] == 15.0


def test_authorizations_overburn_negative_balance(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-overburn-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "AUTH-OVER-1",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active",
        "hcpcs_code": "T1019",
        "total_units_authorized": 100,
        "units_used": 120,
        "unit_type": "15_min",
    })

    r = c.get("/api/v1/clients/me/authorizations", headers=auth_headers("u-client"))
    assert r.status_code == 200
    rec = next(a for a in r.json()["authorizations"] if a["id"] == "auth-overburn-1")
    assert rec["units_remaining"] == -20
    assert rec["remaining_hours"] == -5.0
    assert rec["total_hours"] == 25.0
    assert rec["hours_used"] == 30.0


def test_admin_update_start_end_date_records_audit_log_accurately(client):
    c, db, _ = client
    db["authorizations"].append({
        "id": "auth-audit-1",
        "client_id": "u-client",
        "state_id": 1,
        "authorization_number": "AUTH-AUDIT-1",
        "start_date": "2026-01-01",
        "end_date": "2026-06-30",
        "status": "active",
        "total_units_authorized": 80,
        "units_used": 0,
        "unit_type": "15_min",
    })

    r = c.patch(
        "/api/v1/admin/authorizations/auth-audit-1",
        json={"start_date": "2026-02-01", "end_date": "2026-08-31"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200, r.text

    audit_entry = next(
        a for a in db["audit_logs"]
        if a.get("record_id") == "auth-audit-1" and a.get("action") == "authorization_updated"
    )
    assert audit_entry["old_values"]["start_date"] == "2026-01-01"
    assert audit_entry["old_values"]["end_date"] == "2026-06-30"
    assert audit_entry["new_values"]["start_date"] == "2026-02-01"
    assert audit_entry["new_values"]["end_date"] == "2026-08-31"


def test_compute_auth_units_service_edge_cases():
    from app.services.authorizations import compute_auth_units

    # Empty dict defaults
    res = compute_auth_units({})
    assert res["hcpcs_code"] == "T1019"
    assert res["service_description"] == "Personal Care Services"
    assert res["total_units_authorized"] == 0
    assert res["units_used"] == 0
    assert res["units_remaining"] == 0
    assert res["remaining_hours"] == 0.0

    # Visit unit type
    visit_res = compute_auth_units({
        "total_units_authorized": 10,
        "units_used": 3,
        "unit_type": "visit",
    })
    assert visit_res["units_remaining"] == 7
    assert visit_res["remaining_hours"] == 7.0
    assert visit_res["total_hours"] == 10.0
    assert visit_res["hours_used"] == 3.0

