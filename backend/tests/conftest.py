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
from app.api.routes import caregivers as caregivers_mod
from app.api.routes import admin as admin_mod
from app.api.routes import training as training_mod

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
        self._op = None

    def select(self, columns="*", count=None):
        self.columns = columns
        if count:
            self.count_mode = True
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def in_(self, key, values):
        self.filters.append(("in", key, values))
        return self

    def order(self, col, desc=False):
        self.order_col = col
        self.order_desc = desc
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def single(self):
        self.single_mode = True
        return self

    def insert(self, data):
        self._op = ("insert", data)
        return self

    def update(self, data):
        self._op = ("update", data)
        return self

    def upsert(self, data):
        self._op = ("upsert", data)
        return self

    def delete(self):
        self._op = ("delete", None)
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
            rows = sorted(rows, key=lambda r: r.get(self.order_col) or "", reverse=self.order_desc)
        if self.limit_n is not None:
            rows = rows[: self.limit_n]
        if self.count_mode:
            return FakeResponse(rows, count=len(rows))
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


class FakeSupabase:
    def __init__(self, db, users):
        self.db = db
        self.auth = FakeAuth(users, db)

    def table(self, name):
        return FakeQuery(name, self.db)


def make_db():
    return {
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
        "notifications": [],
        "training_enrollments": [],
        "training_courses": [],
        "audit_logs": [],
        "announcements": [],
        "document_requirements": [],
        "auth_users": [],
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
    monkeypatch.setattr(caregivers_mod, "notify", fake_notify)
    monkeypatch.setattr(admin_mod, "notify", fake_notify)

    c = TestClient(app)
    return c, db, fake