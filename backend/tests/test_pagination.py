"""Pagination envelope + bounds for admin list endpoints (Plan 019)."""
import pytest

from conftest import auth_headers


def seed_apps(db, count=5):
    for i in range(1, count + 1):
        db["caregiver_applications"].append({
            "id": f"app{i}",
            "caregiver_id": "u-caregiver",
            "state_id": 1,
            "status": "submitted",
            "created_at": f"2026-01-{i:02d}T00:00:00Z",
        })


def test_list_caregivers_defaults_when_below_page_size(client):
    c, db, _ = client
    seed_apps(db, count=3)
    r = c.get("/api/v1/admin/caregivers", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert [a["id"] for a in body["applications"]] == ["app3", "app2", "app1"]
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 20
    assert body["pages"] == 1


def test_list_caregivers_pages_through_full_set(client):
    c, db, _ = client
    seed_apps(db, count=25)
    r = c.get(
        "/api/v1/admin/caregivers?page=2&page_size=5",
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["applications"]) == 5
    assert [a["id"] for a in body["applications"]] == ["app20", "app19", "app18", "app17", "app16"]
    assert body["total"] == 25
    assert body["page"] == 2
    assert body["page_size"] == 5
    assert body["pages"] == 5


def test_list_caregivers_over_range_page_returns_empty(client):
    c, db, _ = client
    seed_apps(db, count=10)
    r = c.get(
        "/api/v1/admin/caregivers?page=99&page_size=20",
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["applications"] == []
    assert body["total"] == 10
    assert body["pages"] == 1


def test_list_caregivers_rejects_page_size_over_cap(client):
    c, db, _ = client
    seed_apps(db, count=3)
    r = c.get(
        "/api/v1/admin/caregivers?page_size=1000",
        headers=auth_headers("u-admin"),
    )
    assert r.status_code == 422


def test_list_caregivers_rejects_page_zero(client):
    c, db, _ = client
    r = c.get("/api/v1/admin/caregivers?page=0", headers=auth_headers("u-admin"))
    assert r.status_code == 422


def test_list_documents_keeps_additive_key_shape(client):
    c, db, _ = client
    db["documents"].append({
        "id": "doc1",
        "owner_id": "u-caregiver",
        "status": "pending_review",
        "uploaded_at": "2026-01-01T00:00:00Z",
        "document_types": {"name": "CPR Certificate"},
    })
    r = c.get("/api/v1/admin/documents", headers=auth_headers("u-admin"))
    assert r.status_code == 200
    body = r.json()
    assert len(body["documents"]) == 1
    assert body["documents"][0]["id"] == "doc1"
    assert body["total"] == 1
    assert body["page_size"] == 20


def test_admin_list_requires_admin_role(client):
    c, db, _ = client
    seed_apps(db, count=3)
    r = c.get("/api/v1/admin/caregivers?page=1&page_size=5", headers=auth_headers("u-caregiver"))
    assert r.status_code == 403


def test_fake_mirrors_real_supabase_order_requires_select(client):
    # Real supabase-py: transforms (order/eq/range) only exist on the builder
    # returned by select(). Regression guard for the prod 500 where paginate
    # called .order() on the bare table() builder.
    _, _, fake = client
    with pytest.raises(AttributeError):
        fake.table("announcements").order("created_at", desc=True)
    with pytest.raises(AttributeError):
        fake.table("announcements").eq("status", "all")


def test_fake_allows_transforms_after_select_and_mutation(client):
    _, _, fake = client
    q = fake.table("announcements").select("*", count="exact")
    assert q.order("created_at", desc=True).limit(5) is not None
    q2 = fake.table("announcements").update({"is_active": False})
    assert q2.eq("id", "a1") is not None