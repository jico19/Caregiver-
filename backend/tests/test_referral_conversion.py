"""Tests for Referral Conversion & Assignment (Plan 004)."""
from conftest import auth_headers


def seed_referral(
    db,
    referral_id="ref1",
    state_id=1,
    status="new",
    first_name="Alice",
    last_name="Smith",
    email="alice@test.com",
    phone="555-0199",
    converted_client_id=None,
    assigned_to=None,
    handled_notes=None,
):
    db.setdefault("client_referrals", []).append({
        "id": referral_id,
        "state_id": state_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "status": status,
        "referral_source": "online",
        "notes": "Care needed for aging parent",
        "assigned_to": assigned_to,
        "handled_notes": handled_notes,
        "converted_client_id": converted_client_id,
        "created_at": "2026-01-01T00:00:00Z",
    })


def test_convert_creates_one_pending_client_and_user(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1, status="new")

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    data = r.json()
    assert "client_id" in data

    # Verify referral updated
    ref = db["client_referrals"][0]
    assert ref["status"] == "converted"
    assert ref["converted_client_id"] == data["client_id"]

    # Verify clients table has 1 pending row
    clients = [cl for cl in db.get("clients", []) if cl["id"] == data["client_id"]]
    assert len(clients) == 1
    assert clients[0]["status"] == "pending"
    assert clients[0]["first_name"] == "Alice"
    assert clients[0]["last_name"] == "Smith"
    assert clients[0]["state_id"] == 1


def test_convert_reuses_existing_user_account(client):
    c, db, _ = client
    # Existing user with matching email
    db["users"].append({
        "id": "u-existing-client",
        "email": "alice@test.com",
        "role_id": 3,
        "state_id": 1,
        "status": "active",
        "roles": {"name": "client"},
    })
    seed_referral(db, referral_id="ref1", state_id=1, email="alice@test.com")

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["client_id"] == "u-existing-client"

    # No duplicate user created
    users_with_email = [u for u in db["users"] if u["email"] == "alice@test.com"]
    assert len(users_with_email) == 1


def test_converting_twice_returns_409(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1, status="converted", converted_client_id="c-already")

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 409
    assert "already been converted" in r.json()["detail"]


def test_invalid_status_returns_422(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1)

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "invalid_status"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 422


def test_missing_referral_returns_404(client):
    c, db, _ = client

    r = c.patch(
        "/api/v1/admin/referrals/nonexistent",
        json={"status": "contacted"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 404


def test_caregiver_denied_conversion(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1)

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-caregiver"),
    )
    assert r.status_code == 403


def test_cross_state_conversion_denied(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1)

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin-in"),
    )
    assert r.status_code == 403


def test_super_admin_can_convert_across_states(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1)

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    assert "client_id" in r.json()


def test_unscoped_administrator_denied_conversion(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1)
    for u in db["users"]:
        if u["id"] == "u-admin-fl":
            u["state_id"] = None

    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"status": "converted"},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 403


def test_convert_preserves_referral_state_id(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref-in", state_id=2, email="indiana@test.com")

    r = c.patch(
        "/api/v1/admin/referrals/ref-in",
        json={"status": "converted"},
        headers=auth_headers("u-admin-in"),
    )
    assert r.status_code == 200
    client_id = r.json()["client_id"]

    new_client = next(cl for cl in db["clients"] if cl["id"] == client_id)
    assert new_client["state_id"] == 2


def test_assignment_handled_notes_and_unassigned_filter(client):
    c, db, _ = client
    seed_referral(db, referral_id="ref1", state_id=1, assigned_to=None)
    seed_referral(db, referral_id="ref2", state_id=1, assigned_to="u-admin-fl")

    # Update assigned_to and handled_notes
    r = c.patch(
        "/api/v1/admin/referrals/ref1",
        json={"assigned_to": "u-admin-fl", "handled_notes": "Spoke with daughter. Wants intake next week."},
        headers=auth_headers("u-admin-fl"),
    )
    assert r.status_code == 200
    ref1 = db["client_referrals"][0]
    assert ref1["assigned_to"] == "u-admin-fl"
    assert ref1["handled_notes"] == "Spoke with daughter. Wants intake next week."

    # Test unassigned filter (ref1 is now assigned, but ref2 was assigned too; reset ref2 to None)
    db["client_referrals"][1]["assigned_to"] = None
    r_unassigned = c.get(
        "/api/v1/admin/referrals?unassigned=true",
        headers=auth_headers("u-admin-fl"),
    )
    assert r_unassigned.status_code == 200
    items = r_unassigned.json()["referrals"]
    assert len(items) == 1
    assert items[0]["id"] == "ref2"
