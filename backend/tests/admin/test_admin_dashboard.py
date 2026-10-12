"""Tests for Admin Dashboard Overview (Plan 012 / SharePoint Parity Phase 1)."""
from tests.conftest import auth_headers


def test_admin_dashboard_super_admin(client):
    c, db, _ = client

    # Seed data across FL (1) and GA (3)
    db["caregivers"].extend([
        {"id": "cg1", "state_id": 1, "status": "active"},
        {"id": "cg2", "state_id": 3, "status": "active"},
    ])
    db["clients"].extend([
        {"id": "cl1", "state_id": 1, "status": "active"},
        {"id": "cl2", "state_id": 3, "status": "active"},
    ])
    db["caregiver_applications"].extend([
        {"id": "app1", "state_id": 1, "status": "submitted"},
        {"id": "app2", "state_id": 3, "status": "under_review"},
    ])
    db["documents"].extend([
        {"id": "doc1", "state_id": 1, "status": "pending_review"},
    ])
    db["client_referrals"].extend([
        {
            "id": "ref1",
            "state_id": 1,
            "first_name": "John",
            "last_name": "Smith",
            "referral_source": "Hospital",
            "status": "new",
            "created_at": "2026-10-10T10:00:00Z",
        },
        {
            "id": "ref2",
            "state_id": 3,
            "first_name": "Alice",
            "last_name": "Johnson",
            "referral_source": "MCO",
            "status": "new",
            "created_at": "2026-10-11T12:00:00Z",
        },
    ])
    db["announcements"].append({
        "id": "ann1",
        "title": "Welcome Home Care Update",
        "body": "Important operational notice",
        "audience": "all",
        "state_id": None,
        "is_active": True,
        "created_at": "2026-10-09T08:00:00Z",
    })

    # Super admin request
    res = c.get("/api/v1/admin/dashboard", headers=auth_headers("u-admin"))
    assert res.status_code == 200
    data = res.json()

    assert data["metrics"]["total_caregivers"] == 2
    assert data["metrics"]["total_clients"] == 2
    assert data["metrics"]["pending_applications"] == 2
    assert data["metrics"]["pending_documents"] == 1
    assert data["metrics"]["new_referrals"] == 2
    assert data["metrics"]["pending_compliance"] == 3

    # Recent intakes sorted desc
    assert len(data["recent_intakes"]) == 2
    assert data["recent_intakes"][0]["id"] == "ref2"

    # Open tasks derived
    tasks = {t["id"]: t for t in data["open_tasks"]}
    assert "task-apps" in tasks
    assert "task-docs" in tasks
    assert "task-referrals" in tasks

    # Announcements
    assert len(data["announcements"]) == 1
    assert data["announcements"][0]["title"] == "Welcome Home Care Update"


def test_admin_dashboard_scoped_admin_isolation(client):
    c, db, _ = client

    # Seed FL (1) and GA (3)
    db["caregivers"].extend([
        {"id": "cg1", "state_id": 1, "status": "active"},
        {"id": "cg2", "state_id": 3, "status": "active"},
    ])
    db["client_referrals"].extend([
        {
            "id": "ref-fl",
            "state_id": 1,
            "first_name": "FL Client",
            "last_name": "Test",
            "referral_source": "Hospital",
            "status": "new",
            "created_at": "2026-10-10T10:00:00Z",
        },
        {
            "id": "ref-ga",
            "state_id": 3,
            "first_name": "GA Client",
            "last_name": "Test",
            "referral_source": "MCO",
            "status": "new",
            "created_at": "2026-10-11T12:00:00Z",
        },
    ])

    # Florida admin should only see Florida data
    res = c.get("/api/v1/admin/dashboard", headers=auth_headers("u-admin-fl"))
    assert res.status_code == 200
    data = res.json()

    assert data["metrics"]["total_caregivers"] == 1
    assert data["metrics"]["new_referrals"] == 1
    assert len(data["recent_intakes"]) == 1
    assert data["recent_intakes"][0]["id"] == "ref-fl"


def test_admin_dashboard_denies_caregiver_and_client(client):
    c, _, _ = client

    res = c.get("/api/v1/admin/dashboard", headers=auth_headers("u-caregiver"))
    assert res.status_code == 403

    res_client = c.get("/api/v1/admin/dashboard", headers=auth_headers("u-client"))
    assert res_client.status_code == 403


def test_admin_dashboard_cross_state_filter_rejected_for_scoped_admin(client):
    c, db, _ = client

    # FL admin attempting to view Georgia data via ?state=georgia
    res = c.get("/api/v1/admin/dashboard?state=georgia", headers=auth_headers("u-admin-fl"))
    assert res.status_code == 403
