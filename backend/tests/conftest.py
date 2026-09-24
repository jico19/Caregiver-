"""Shared pytest fixtures: in-memory fake Supabase + FastAPI TestClient.

The route modules call `get_supabase()` (and `get_supabase_anon()`), which we
monkeypatch to return a single FakeSupabase backed by an in-memory `db` dict.
Each test gets a fresh `(client, db, fake)` via the `client` fixture.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.core import supabase as supabase_mod
from app.services import document_service as document_service_mod
from app.api.routes import caregivers as caregivers_mod
from app.api.routes import admin as admin_mod
from app.api.routes import training as training_mod
from app.api.routes import clients as clients_mod

USERS = {
    "u-admin": {"id": "u-admin", "email": "admin@test.com", "role": "administrator", "state_id": 1},
    "u-caregiver": {"id": "u-caregiver", "email": "caregiver@test.com", "role": "caregiver", "state_id": 1},
    "u-client": {"id": "u-client", "email": "client@test.com", "role": "client", "state_id": 1},
}


def auth_headers(user_key):
    return {"Authorization": f"Bearer token-{user_key}"}


class FakeResponse:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    def __init__(self, table_name, db):
        self.table_name = table_name
        self.db = db
        self.columns = "*"
        self.filters = []
        self.single_mode = False
        self.count_mode = False
        self.order_col = None
        self.order_desc = False
        self.limit_n = None
        self._offset = 0
        self._op = None
        self._transformable = False

    def _require_transformable(self, attr):
        # Match real supabase-py: filters/transforms (eq, order, range, limit)
        # only exist on the builder returned by select()/update()/delete()/upsert(),
        # NOT on the bare table() builder ('SyncRequestBuilder').
        if not self._transformable:
            raise AttributeError(
                f"'SyncRequestBuilder' object has no attribute '{attr}'"
            )

    def select(self, columns="*", count=None):
        self.columns = columns
        self._transformable = True
        if count:
            self.count_mode = True
        return self

    def eq(self, key, value):
        self._require_transformable("eq")
        self.filters.append(("eq", key, value))
        return self

    def in_(self, key, values):
        self._require_transformable("in_")
        self.filters.append(("in", key, values))
        return self

    def order(self, col, desc=False):
        self._require_transformable("order")
        self.order_col = col
        self.order_desc = desc
        return self

    def limit(self, n):
        self._require_transformable("limit")
        self.limit_n = n
        return self

    def range(self, start, end):
        self._require_transformable("range")
        self._offset = start
        self.limit_n = end - start + 1
        return self

    def single(self):
        self.single_mode = True
        return self

    def insert(self, data):
        self._op = ("insert", data)
        return self

    def update(self, data):
        self._op = ("update", data)
        self._transformable = True
        return self

    def upsert(self, data):
        self._op = ("upsert", data)
        self._transformable = True
        return self

    def delete(self):
        self._op = ("delete", None)
        self._transformable = True
        return self

    def _matches(self, row):
        for ftype, key, value in self.filters:
            if ftype == "eq" and row.get(key) != value:
                return False
            if ftype == "in" and row.get(key) not in value:
                return False
        return True

    def _matching_rows(self):
        return [r for r in self.db.get(self.table_name, []) if self._matches(r)]

    def _run_mutation(self, op, data):
        coll = self.db.setdefault(self.table_name, [])
        items = data if isinstance(data, list) else [data]
        placed = []
        if op == "insert":
            seq = self.db.setdefault("__counters", {}).get(self.table_name, 0)
            for item in items:
                if item.get("id") is None:
                    seq += 1
                    item["id"] = f"{self.table_name}-{seq}"
            self.db["__counters"][self.table_name] = seq
            coll.extend(items)
            placed = items
        elif op == "update":
            for row in coll:
                if self._matches(row):
                    row.update(data)
                    placed.append(row)
        elif op == "upsert":
            for item in items:
                idx = next((i for i, r in enumerate(coll) if r.get("id") == item.get("id")), None)
                if idx is not None:
                    coll[idx] = {**coll[idx], **item}
                    placed.append(coll[idx])
                else:
                    coll.append(item)
                    placed.append(item)
        elif op == "delete":
            for row in list(coll):
                if self._matches(row):
                    coll.remove(row)
                    placed.append(row)
        return FakeResponse(placed)

    def execute(self):
        if self._op is not None:
            op, data = self._op
            self._op = None
            return self._run_mutation(op, data)

        rows = self._matching_rows()
        if self.order_col:
            def _sort_key(row):
                v = row.get(self.order_col)
                if v is None or v == "":
                    return (1, 0)
                return (0, v)
            rows = sorted(rows, key=_sort_key, reverse=self.order_desc)
        total = len(rows) if self.count_mode else None
        if self._offset:
            rows = rows[self._offset:]
        if self.limit_n is not None:
            rows = rows[: self.limit_n]
        if self.count_mode:
            return FakeResponse(rows, count=total)
        if self.single_mode:
            return FakeResponse(rows[0] if rows else None)
        return FakeResponse(rows)


class FakeUser:
    def __init__(self, uid, email):
        self.id = uid
        self.email = email


class FakeAuth:
    def __init__(self, users, db):
        self.token_map = {f"token-{k}": v for k, v in users.items()}
        self.db = db
        self.admin = FakeAdmin(db)

    def get_user(self, token):
        record = self.token_map.get(token)
        if record is None:
            raise Exception("Invalid token")
        return type("Res", (), {"user": FakeUser(record["id"], record["email"])})()

    def sign_in_with_password(self, data):
        return type("Res", (), {"session": None})()


class FakeAdmin:
    def __init__(self, db):
        self.db = db

    def create_user(self, data):
        email = data["email"]
        uid = "u-" + email.split("@")[0]
        self.db.setdefault("auth_users", []).append({"id": uid, "email": email})
        return type("Res", (), {"user": FakeUser(uid, email)})()


class FakeBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, file, file_options=None):
        self.uploads.append(path)
        return {"Key": path}

    def create_signed_url(self, path, expires_in):
        return {"signedURL": f"https://storage.test/{path}?sig=abc"}


class FakeStorage:
    def __init__(self):
        self.buckets = {}

    def from_(self, bucket):
        b = self.buckets.get(bucket)
        if b is None:
            b = FakeBucket()
            self.buckets[bucket] = b
        return b


class FakeSupabase:
    def __init__(self, db, users):
        self.db = db
        self.auth = FakeAuth(users, db)
        self.storage = FakeStorage()

    def table(self, name):
        return FakeQuery(name, self.db)


def make_db():
    return {
        "states": [
            {"id": 1, "code": "FL", "name": "Florida", "slug": "florida", "active": True},
            {"id": 2, "code": "IN", "name": "Indiana", "slug": "indiana", "active": True},
            {"id": 3, "code": "GA", "name": "Georgia", "slug": "georgia", "active": True},
        ],
        "users": [
            {"id": "u-admin", "email": "admin@test.com", "role_id": 4, "state_id": 1, "status": "active", "roles": {"name": "administrator"}},
            {"id": "u-caregiver", "email": "caregiver@test.com", "role_id": 2, "state_id": 1, "status": "active", "roles": {"name": "caregiver"}},
            {"id": "u-client", "email": "client@test.com", "role_id": 3, "state_id": 1, "status": "active", "roles": {"name": "client"}},
        ],
        "roles": [
            {"id": 2, "name": "caregiver"},
        ],
        "caregivers": [],
        "caregiver_applications": [],
        "documents": [],
        "document_types": [
            {"id": 1, "name": "Authorization Document", "for_role": "client", "requires_expiration": True},
        ],
        "notifications": [],
        "training_enrollments": [],
        "training_courses": [],
        "audit_logs": [],
        "announcements": [],
        "document_requirements": [],
        "auth_users": [],
        "authorizations": [],
        "client_agreements": [],
        "clients": [],
        "client_referrals": [],
        "care_plans": [],
        "care_plan_activities": [],
        "care_schedules": [],
    }


@pytest.fixture
def client(monkeypatch):
    db = make_db()
    fake = FakeSupabase(db, USERS)

    def fake_notify(sb, user_id, type_, title, body, reference_id=None):
        n = {
            "user_id": user_id,
            "type": type_,
            "title": title,
            "body": body,
        }
        if reference_id:
            n["reference_id"] = reference_id
        db["notifications"].append(n)

    monkeypatch.setattr(supabase_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(supabase_mod, "get_supabase_anon", lambda: fake)
    monkeypatch.setattr(caregivers_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(caregivers_mod, "get_supabase_anon", lambda: fake)
    monkeypatch.setattr(admin_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(training_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(clients_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(document_service_mod, "get_supabase", lambda: fake)
    monkeypatch.setattr(caregivers_mod, "notify", fake_notify)
    monkeypatch.setattr(admin_mod, "notify", fake_notify)
    monkeypatch.setattr(clients_mod, "notify", fake_notify)

    c = TestClient(app)
    return c, db, fake