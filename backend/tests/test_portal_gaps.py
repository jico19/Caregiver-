"""Portal gap features: credential status panels, announcements, reminders, certificate."""
from datetime import date
from conftest import auth_headers


def seed_caregiver(db, state_id=1):
    db["caregivers"].append({
        "id": "u-caregiver",
        "state_id": state_id,
        "first_name": "Sarah",
        "last_name": "Jenkins",
    })


# ---------- credential status ----------

def test_credential_status_classifies_documents(client):
    c, db, _ = client
    seed_caregiver(db)
    db["document_requirements"].append({
        "document_type_id": 2,
        "required": True,
        "state_id": 1,
        "document_types": {"name": "CPR Certificate"},
    })
    db["document_requirements"].append({
        "document_type_id": 3,
        "required": True,
        "state_id": 1,
        "document_types": {"name": "CNA/HHA Certificate"},
    })
    db["documents"].extend([
        {"id": "doc-cpr", "owner_id": "u-caregiver", "document_type_id": 2,
         "status": "approved", "expiration_date": "2027-01-01",
         "document_types": {"name": "CPR Certificate", "requires_expiration": True}},
        {"id": "doc-tb", "owner_id": "u-caregiver", "document_type_id": 7,
         "status": "expired", "expiration_date": "2025-08-01",
         "document_types": {"name": "TB Test", "requires_expiration": True}},
        {"id": "doc-dl", "owner_id": "u-caregiver", "document_type_id": 8,
         "status": "approved", "expiration_date": "2026-10-15",
         "document_types": {"name": "Driver License", "requires_expiration": True}},
    ])

    r = c.get("/api/v1/caregivers/me/credential-status", headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    body = r.json()
    assert body["state_id"] == 1
    missing_names = [m["name"] for m in body["missing"]]
    assert "CNA/HHA Certificate" in missing_names
    assert "CPR Certificate" not in missing_names
    assert len(body["expired"]) == 1
    assert body["expired"][0]["name"] == "TB Test"
    assert len(body["expiring_soon"]) == 1
    assert body["expiring_soon"][0]["name"] == "Driver License"
    assert body["summary"]["expired"] == 1
    assert body["summary"]["compliant"] is False


# ---------- announcements feed ----------

def seed_announcement(db, title, audience="caregiver", state_id=1, active=True):
    db["announcements"].append({
        "id": title,
        "title": title,
        "body": "Details here.",
        "audience": audience,
        "state_id": state_id,
        "is_active": active,
        "created_at": "2026-01-01T00:00:00Z",
    })


def test_announcements_feed_filters_by_audience_and_state(client):
    c, db, _ = client
    seed_caregiver(db)
    seed_announcement(db, "For FL caregivers", audience="caregiver", state_id=1)
    seed_announcement(db, "For everyone", audience="all", state_id=None)
    seed_announcement(db, "For GA caregivers", audience="caregiver", state_id=2)
    seed_announcement(db, "For clients", audience="client", state_id=1)
    seed_announcement(db, "Inactive", audience="caregiver", state_id=1, active=False)

    r = c.get("/api/v1/caregivers/me/announcements", headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    titles = {a["title"] for a in r.json()["announcements"]}
    assert titles == {"For FL caregivers", "For everyone"}


# ---------- credential reminders (idempotent job) ----------

def _run_scan(db, fake):
    from app.jobs.credential_reminders import scan_due_credentials
    return scan_due_credentials(fake, today=date(2026, 1, 15))


def test_credential_reminders_are_idempotent(client):
    c, db, fake = client
    db["documents"][:] = [
        {"id": "doc1", "owner_id": "u-caregiver", "status": "expired",
         "expiration_date": "2025-12-01",
         "document_types": {"name": "CPR Certificate"}},
        {"id": "doc2", "owner_id": "u-caregiver", "status": "approved",
         "expiration_date": "2026-01-30",
         "document_types": {"name": "Driver License"}},
        {"id": "doc3", "owner_id": "u-caregiver", "status": "approved",
         "expiration_date": "2026-12-31",
         "document_types": {"name": "TB Test"}},
    ]
    assert _run_scan(db, fake) == 2
    types = sorted(n["type"] for n in db["notifications"])
    assert types == ["credential_expired", "credential_expiring"]
    assert all(n["reference_id"] for n in db["notifications"])
    assert _run_scan(db, fake) == 0
    assert len(db["notifications"]) == 2


# ---------- admin announcements CRUD ----------

def test_admin_announcement_create_update_delete(client):
    c, db, _ = client
    admin = auth_headers("u-admin")

    r = c.post("/api/v1/admin/announcements", json={
        "title": "New policy",
        "body": "Updated policy effective next month.",
        "audience": "caregiver",
        "is_active": True,
    }, headers=admin)
    assert r.status_code == 200
    db["announcements"][0]["id"] = "ann1"
    ann_id = "ann1"
    assert any(l["action"] == "announcement_created" for l in db["audit_logs"])

    r = c.patch(f"/api/v1/admin/announcements/{ann_id}", json={
        "is_active": False,
        "title": "Updated policy",
    }, headers=admin)
    assert r.status_code == 200
    row = db["announcements"][0]
    assert row["is_active"] is False
    assert row["title"] == "Updated policy"

    r = c.delete(f"/api/v1/admin/announcements/{ann_id}", headers=admin)
    assert r.status_code == 200
    assert db["announcements"] == []
    assert any(l["action"] == "announcement_deleted" for l in db["audit_logs"])


def test_admin_announcement_update_requires_exists(client):
    c, db, _ = client
    r = c.patch("/api/v1/admin/announcements/missing-id", json={"title": "x"},
                headers=auth_headers("u-admin"))
    assert r.status_code == 404


# ---------- training certificate ----------

def test_training_certificate_requires_completed_enrollment(client):
    c, db, _ = client
    db["training_courses"].append({"id": "c1", "name": "HIPAA Basics", "active": True})
    db["training_enrollments"].append({
        "id": "enr1",
        "course_id": "c1",
        "caregiver_id": "u-caregiver",
        "status": "in_progress",
    })
    r = c.get("/api/v1/training/courses/c1/certificate", headers=auth_headers("u-caregiver"))
    assert r.status_code == 403


def test_training_certificate_returns_details(client):
    c, db, _ = client
    db["training_courses"].append({"id": "c1", "name": "HIPAA Basics", "active": True})
    db["caregivers"].append({
        "id": "u-caregiver",
        "state_id": 1,
        "first_name": "Sarah",
        "last_name": "Jenkins",
    })
    db["training_enrollments"].append({
        "id": "enr1",
        "course_id": "c1",
        "caregiver_id": "u-caregiver",
        "status": "completed",
        "completed_at": "2026-06-01T10:00:00Z",
    })
    r = c.get("/api/v1/training/courses/c1/certificate", headers=auth_headers("u-caregiver"))
    assert r.status_code == 200
    cert = r.json()["certificate"]
    assert cert["course_name"]
    assert cert["caregiver_name"] == "Sarah Jenkins"
    assert len(cert["certificate_number"]) == 10