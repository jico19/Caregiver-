"""Admin referrals inbox & status workflow (Part 1)."""
from conftest import auth_headers


def seed_referrals(db):
    db["client_referrals"].extend([
        {"id": "ref-1", "state_id": 1, "first_name": "Eleanor", "last_name": "Vance",
         "phone": "555-0101", "email": "eleanor@example.com",
         "referral_source": "Physician Referral", "notes": "Needs PCA weekly.",
         "status": "new", "created_at": "2026-09-20T10:00:00+00:00", "updated_at": "2026-09-20T10:00:00+00:00",
         "states": {"code": "FL", "name": "Florida"}},
        {"id": "ref-2", "state_id": 2, "first_name": "Thomas", "last_name": "Sterling",
         "phone": "555-0102", "email": "thomas@example.com",
         "referral_source": "Website Inquiry", "notes": "Medicaid waiver question.",
         "status": "contacted", "created_at": "2026-09-21T10:00:00+00:00", "updated_at": "2026-09-21T10:00:00+00:00",
         "states": {"code": "IN", "name": "Indiana"}},
    ])


# ---------- listing ----------

def test_referrals_empty_returns_empty_list(client):
    c, db, _ = client
    r = c.get("/api/v1/admin/referrals", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["referrals"] == []
    assert body["total"] == 0


def test_referrals_list_joins_state_ordered_newest_first(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["referrals"][0]["id"] == "ref-2"  # newest first
    assert body["referrals"][0]["states"]["code"] == "IN"
    assert body["referrals"][1]["states"]["code"] == "FL"


def test_referrals_list_status_filter(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals?status=new", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["referrals"][0]["id"] == "ref-1"


def test_referrals_list_state_filter(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals?state_id=2", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["referrals"][0]["id"] == "ref-2"


def test_referrals_list_invalid_status_422(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals?status=spam", headers=auth_headers("u-admin"))
    assert r.status_code == 422


def test_referrals_list_pagination(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals?page=1&page_size=1", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["pages"] == 2
    assert len(body["referrals"]) == 1


def test_referrals_requires_admin(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.get("/api/v1/admin/referrals", headers=auth_headers("u-caregiver"))
    assert r.status_code == 403


# ---------- status workflow ----------

def test_referral_patch_updates_status_and_logs_audit(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.patch("/api/v1/admin/referrals/ref-1", json={"status": "contacted"}, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    assert r.json()["referral"]["status"] == "contacted"
    row = next(x for x in db["client_referrals"] if x["id"] == "ref-1")
    assert row["status"] == "contacted"
    assert db["audit_logs"][-1]["action"] == "referral_status_changed"
    assert db["audit_logs"][-1]["record_id"] == "ref-1"
    assert db["audit_logs"][-1]["old_values"] == {"status": "new"}
    assert db["audit_logs"][-1]["new_values"] == {"status": "contacted"}


def test_referral_patch_invalid_status_422(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.patch("/api/v1/admin/referrals/ref-1", json={"status": "deleted"}, headers=auth_headers("u-admin"))
    assert r.status_code == 422


def test_referral_patch_missing_404(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.patch("/api/v1/admin/referrals/nope", json={"status": "closed"}, headers=auth_headers("u-admin"))
    assert r.status_code == 404


def test_referral_patch_requires_admin(client):
    c, db, _ = client
    seed_referrals(db)
    r = c.patch("/api/v1/admin/referrals/ref-1", json={"status": "converted"}, headers=auth_headers("u-client"))
    assert r.status_code == 403