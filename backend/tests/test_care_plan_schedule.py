"""DB-backed care plan & schedule (Iteration 2)."""
from conftest import auth_headers


def seed_client_profile(db, state_id=1):
    db["clients"].append({
        "id": "u-client",
        "state_id": state_id,
        "first_name": "Maya",
        "last_name": "Rivera",
    })


def seed_care_plan(db, plan_id="plan-1", client_id="u-client"):
    db["care_plans"].append({
        "id": plan_id,
        "client_id": client_id,
        "state_id": 1,
        "status": "active",
        "effective_date": "2026-02-01",
        "primary_nurse": "RN Pat Lin",
        "emergency_protocol": "Call 911 then the on-call supervisor.",
        "created_by": "u-admin",
    })
    db["care_plan_activities"].extend([
        {"id": "act-1", "care_plan_id": plan_id, "task": "Bathing & Grooming", "frequency": "Daily (Morning)", "notes": "Frail skin, pat dry.", "sort_order": 1},
        {"id": "act-2", "care_plan_id": plan_id, "task": "Meal Prep", "frequency": "Twice daily", "notes": "Low sodium.", "sort_order": 2},
    ])


def seed_schedule(db, rows=None):
    db["care_schedules"].extend(rows or [
        {"id": "s1", "client_id": "u-client", "state_id": 1, "day_of_week": "Monday",
         "start_time": "09:00:00", "end_time": "13:00:00", "service": "Personal Care", "status": "confirmed", "sort_order": 1},
        {"id": "s2", "client_id": "u-client", "state_id": 1, "day_of_week": "Friday",
         "start_time": "14:00:00", "end_time": "16:00:00", "service": "Respite", "status": "scheduled", "sort_order": 2},
    ])


# ---------- client read endpoints (empty states) ----------

def test_client_care_plan_empty_returns_none(client):
    c, db, _ = client
    seed_client_profile(db)
    r = c.get("/api/v1/clients/me/care-plan", headers=auth_headers("u-client"))
    assert r.status_code == 200
    assert r.json()["care_plan"] is None


def test_client_schedule_empty_returns_empty_list(client):
    c, db, _ = client
    seed_client_profile(db)
    r = c.get("/api/v1/clients/me/schedule", headers=auth_headers("u-client"))
    assert r.status_code == 200
    assert r.json()["schedule"] == []


# ---------- client read endpoints (seeded data) ----------

def test_client_care_plan_returns_seeded_rows(client):
    c, db, _ = client
    seed_client_profile(db)
    seed_care_plan(db)
    r = c.get("/api/v1/clients/me/care-plan", headers=auth_headers("u-client"))
    assert r.status_code == 200
    plan = r.json()["care_plan"]
    assert plan["client_name"] == "Maya Rivera"
    assert plan["plan_status"] == "active"
    assert plan["primary_nurse"] == "RN Pat Lin"
    assert plan["effective_date"] == "2026-02-01"
    tasks = [a["task"] for a in plan["daily_activities"]]
    assert tasks == ["Bathing & Grooming", "Meal Prep"]
    assert plan["emergency_protocol"].startswith("Call 911")


def test_client_schedule_returns_mapped_rows(client):
    c, db, _ = client
    seed_client_profile(db)
    seed_schedule(db)
    r = c.get("/api/v1/clients/me/schedule", headers=auth_headers("u-client"))
    assert r.status_code == 200
    schedule = r.json()["schedule"]
    assert len(schedule) == 2
    assert schedule[0]["day"] == "Monday"  # day ordering
    assert schedule[0]["time"] == "09:00 AM - 01:00 PM"
    assert schedule[0]["status"] == "Confirmed"
    assert schedule[0]["branch"] == "FL"
    assert schedule[1]["status"] == "Scheduled"


def test_client_schedule_only_returns_own_rows(client):
    c, db, _ = client
    seed_client_profile(db)
    seed_schedule(db)
    db["care_schedules"].append({
        "id": "s-other", "client_id": "some-other-client", "state_id": 2, "day_of_week": "Sunday",
        "start_time": "08:00:00", "end_time": "10:00:00", "service": "Other", "status": "scheduled", "sort_order": 1,
    })
    r = c.get("/api/v1/clients/me/schedule", headers=auth_headers("u-client"))
    assert len(r.json()["schedule"]) == 2


# ---------- admin client detail ----------

def test_admin_get_client_detail(client):
    c, db, _ = client
    seed_client_profile(db)
    r = c.get("/api/v1/admin/clients/u-client", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    assert r.json()["client"]["first_name"] == "Maya"


def test_admin_get_client_detail_404(client):
    c, db, _ = client
    r = c.get("/api/v1/admin/clients/does-not-exist", headers=auth_headers("u-admin"))
    assert r.status_code == 404


def test_caregiver_cannot_administer_clients(client):
    c, db, _ = client
    r = c.get("/api/v1/admin/clients/u-client", headers=auth_headers("u-caregiver"))
    assert r.status_code == 403


# ---------- admin care plan CRUD ----------

def test_admin_get_care_plan_empty_and_put_creates(client):
    c, db, _ = client
    seed_client_profile(db)
    r = c.get("/api/v1/admin/clients/u-client/care-plan", headers=auth_headers("u-admin"))
    assert r.json()["care_plan"] is None

    r = c.put("/api/v1/admin/clients/u-client/care-plan", json={
        "status": "active",
        "effective_date": "2026-03-01",
        "primary_nurse": "RN Dana Cole",
        "emergency_protocol": "Call 911 first.",
        "activities": [
            {"task": "Bathing", "frequency": "Daily", "notes": "Pat dry.", "sort_order": 1},
        ],
    }, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    plan = r.json()["care_plan"]
    assert plan["primary_nurse"] == "RN Dana Cole"
    assert [a["task"] for a in plan["activities"]] == ["Bathing"]
    assert db["care_plans"][0]["created_by"] == "u-admin"


def test_admin_put_care_plan_replaces_activities(client):
    c, db, _ = client
    seed_client_profile(db)
    seed_care_plan(db)

    r = c.put("/api/v1/admin/clients/u-client/care-plan", json={
        "status": "pending",
        "emergency_protocol": "Updated protocol.",
        "activities": [
            {"task": "New Task A"},
            {"task": "New Task B"},
        ],
    }, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    plan = r.json()["care_plan"]
    assert plan["status"] == "pending"
    assert plan["emergency_protocol"] == "Updated protocol."
    assert [a["task"] for a in plan["activities"]] == ["New Task A", "New Task B"]
    assert len(db["care_plan_activities"]) == 2


def test_admin_put_care_plan_unknown_client_404(client):
    c, db, _ = client
    r = c.put("/api/v1/admin/clients/nope/care-plan", json={"primary_nurse": "RN X"},
              headers=auth_headers("u-admin"))
    assert r.status_code == 404


# ---------- admin schedule CRUD ----------

def test_admin_schedule_crud(client):
    c, db, _ = client
    seed_client_profile(db)

    r = c.get("/api/v1/admin/clients/u-client/schedule", headers=auth_headers("u-admin"))
    assert r.json()["schedule"] == []

    r = c.post("/api/v1/admin/clients/u-client/schedule", json={
        "day_of_week": "Wednesday", "start_time": "09:00", "end_time": "12:00",
        "service": "Personal Care", "status": "confirmed",
    }, headers=auth_headers("u-admin"))
    assert r.status_code == 200
    entry_id = r.json()["entry"]["id"]
    assert entry_id
    assert r.json()["entry"]["sort_order"] == 0

    r = c.get("/api/v1/admin/clients/u-client/schedule", headers=auth_headers("u-admin"))
    entries = r.json()["schedule"]
    assert len(entries) == 1
    assert entries[0]["day_of_week"] == "Wednesday"

    r = c.delete(f"/api/v1/admin/clients/u-client/schedule/{entry_id}", headers=auth_headers("u-admin"))
    assert r.status_code == 200

    r = c.get("/api/v1/admin/clients/u-client/schedule", headers=auth_headers("u-admin"))
    assert r.json()["schedule"] == []

    # Deleting again is a 404
    r = c.delete(f"/api/v1/admin/clients/u-client/schedule/{entry_id}", headers=auth_headers("u-admin"))
    assert r.status_code == 404


def test_admin_schedule_scoped_to_client(client):
    c, db, _ = client
    seed_client_profile(db)
    seed_schedule(db)  # u-client rows

    r = c.delete("/api/v1/admin/clients/other-client/schedule/s1", headers=auth_headers("u-admin"))
    assert r.status_code == 404