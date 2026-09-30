"""Tests for Client Admission Lifecycle (Plan 003)."""
from conftest import auth_headers


def seed_client(db, client_id="c1", state_id=1, status="pending", service_start_date=None):
    db.setdefault("clients", []).append({
        "id": client_id,
        "state_id": state_id,
        "first_name": "Jane",
        "last_name": "Doe",
        "date_of_birth": "1950-01-01",
        "phone": "555-0100",
        "address": "123 Main St",
        "medicaid_number": "MED123456",
        "status": status,
        "service_start_date": service_start_date,
        "admitted_by": None,
        "admitted_at": None,
        "admission_notes": None,
        "rejection_reason": None,
        "created_at": "2026-01-01T00:00:00Z",
    })


def test_admin_same_state_can_admit_client(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved", "service_start_date": "2026-10-01", "notes": "All documents verified."},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    row = db["clients"][0]
    assert row["status"] == "approved"
    assert row["admitted_by"] == "u-admin-fl"
    assert row["admitted_at"] is not None
    assert row["service_start_date"] == "2026-10-01"
    assert row["admission_notes"] == "All documents verified."


def test_admin_cross_state_denied_by_id_and_list(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    # Access by ID is denied
    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved"},
        headers=auth_headers("u-admin-in"),
    )
    assert r.status_code == 403

    # Excluded in list
    list_r = c.get("/api/v1/admin/clients", headers=auth_headers("u-admin-in"))
    assert list_r.status_code == 200
    assert len(list_r.json()["clients"]) == 0


def test_super_admin_can_admit_across_states(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved", "service_start_date": "2026-10-05"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    row = db["clients"][0]
    assert row["status"] == "approved"
    assert row["admitted_by"] == "u-admin"


def test_caregiver_cannot_admit_client(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved"},
        headers=auth_headers("u-caregiver"),
    )
    assert r.status_code == 403


def test_unscoped_administrator_denied(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")
    for u in db["users"]:
        if u["id"] == "u-admin-fl":
            u["state_id"] = None

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 403



def test_rejection_requires_reason_and_stores_separately(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    # Missing reason -> 400
    r_fail = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "rejected"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r_fail.status_code == 400

    # With reason -> 200 and saved to rejection_reason
    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "rejected", "rejection_reason": "Medicaid coverage unverified"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    row = db["clients"][0]
    assert row["status"] == "rejected"
    assert row["rejection_reason"] == "Medicaid coverage unverified"


def test_invalid_and_state_skipping_transitions_rejected(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    # State skipping (pending -> active) -> 409
    r_skip = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "active"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r_skip.status_code == 409

    # Terminal state transition (rejected -> approved) -> 409
    db["clients"][0]["status"] = "rejected"
    r_term = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r_term.status_code == 409


def test_approving_sets_admitted_by_at_and_service_start_date(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved", "service_start_date": "2026-11-01", "notes": "Ready for care"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    row = db["clients"][0]
    assert row["status"] == "approved"
    assert row["admitted_by"] == "u-admin-fl"
    assert row["admitted_at"] is not None
    assert row["service_start_date"] == "2026-11-01"
    assert row["admission_notes"] == "Ready for care"


def test_cross_state_service_start_date_write_denied(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending")

    r = c.post(
        "/api/v1/admin/clients/c1/admission",
        json={"status": "approved", "service_start_date": "2026-11-01"},
        headers=auth_headers("u-admin-in"),
    )
    assert r.status_code == 403


def test_client_sees_own_status_via_me(client):
    c, db, _ = client
    seed_client(db, client_id="u-client", state_id=1, status="approved", service_start_date="2026-10-15")

    r = c.get("/api/v1/clients/me", headers=auth_headers("u-client"))
    assert r.status_code == 200
    profile = r.json()["profile"]
    assert profile["status"] == "approved"
    assert profile["service_start_date"] == "2026-10-15"


def test_list_clients_status_filter_and_sort(client):
    c, db, _ = client
    seed_client(db, client_id="c1", state_id=1, status="pending", service_start_date="2026-10-20")
    seed_client(db, client_id="c2", state_id=1, status="approved", service_start_date="2026-10-05")

    # Filter by status
    r_filter = c.get("/api/v1/admin/clients?status=approved", headers=auth_headers("u-admin-fl"))
    assert r_filter.status_code == 200
    items = r_filter.json()["clients"]
    assert len(items) == 1
    assert items[0]["id"] == "c2"

    # Sort by service_start_date
    r_sort = c.get("/api/v1/admin/clients?sort_by=service_start_date", headers=auth_headers("u-admin-fl"))
    assert r_sort.status_code == 200
    sorted_items = r_sort.json()["clients"]
    assert len(sorted_items) == 2
    assert sorted_items[0]["id"] == "c2"
    assert sorted_items[1]["id"] == "c1"
