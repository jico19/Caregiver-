# Plan 019 — Supabase-Native Pagination (Iteration 1)

**Source:** `SCALING_CHECKLIST.md` Tier 1 (paginate unbounded admin lists)
**Decision context:** `fastapi-pagination` has no PostgREST/supabase-py adapter, so
we'd write glue either way; native `.range()/.limit()/.count('exact')` satisfies
the no-new-frameworks rule. See `specs/` note below.
**Status:** Approved — implementation ready to start

## Scope

- Shared Supabase pagination helper + a validated `PaginationParams` model.
- Apply to every **list** endpoint in `app/api/routes/admin.py`
  (`/caregivers`, `/documents`, `/clients`, `/authorizations`, `/audit-logs`,
  `/announcements`).
- Non-negotiable: response stays **additive** (existing list key preserved) so
  the current frontend keeps working untouched; pagination metadata is added
  alongside and consumed by the frontend in a later round.
- Out of scope: public content endpoints (`states/services/forms/...`, fixed
  small sets), per-user lists (`/me/documents`, `/me/notifications`,
  `/my-enrollments`, short per-user rows), frontend changes, keyset mode.

## Decisions locked

1. **Native Supabase pagination.** `query.range(start, end)` + `count="exact"`,
   where `start = (page - 1) * page_size` and `end = start + page_size - 1`
   (PostgREST `range` end is **inclusive** — easy off-by-one trap).
2. **No `fastapi-pagination` dependency.** Its cursor adapter can't target
   PostgREST cleanly; offset is fine at thousands of rows. If deep-offset ever
   hurts, upgrade to a keyset helper (WHERE `created_at < last_seen`), which is
   native PostgREST filters and independent of this plan.
3. **Param names:** `page` (default `1`, `ge=1`) and `page_size`
   (default `20`, `ge=1`, `le=100`).
4. **Response envelope** (additive metadata only):
   ```json
   {
     "applications": [ ... ],      // existing key, unchanged
     "total": 57,
     "page": 1,
     "page_size": 20,
     "pages": 3
   }
   ```

## Deliverables

### A. Shared helper — `backend/app/utils/pagination.py` (new)

```python
from typing import Optional
from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


def paginate(query, params: PaginationParams) -> dict:
    """Apply Supabase range paging to an already-selected query builder.

    Call sites MUST build the query as
    ``table(...).select("<columns>", count="exact")`` and chain filters/order
    first — in supabase-py, filter/transform methods (``eq``, ``order``,
    ``range``) only exist on the builder returned by ``select``, and ``count``
    is only settable as a kwarg of ``select``. This helper only adds the
    ``range`` slice and reads ``res.count`` (PostgREST COUNT) so ``total`` is
    real, not ``len(fetched)``. ``range(start, end)`` has an inclusive end.
    """
    start = (params.page - 1) * params.page_size
    end = start + params.page_size - 1
    res = query.range(start, end).execute()
    items = res.data or []
    total = res.count if getattr(res, "count", None) is not None else len(items)
    pages = (total + params.page_size - 1) // params.page_size if total else 0
    return {
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": pages,
        "items": items,
    }
```

> Critical API constraint (why the helper does NOT call `.select()`): supabase-py's
> `table()` returns `SyncRequestBuilder`, which only has
> `select/insert/update/upsert/delete/rpc`. Filters (`eq`) and transforms
> (`order`, `range`, `limit`) exist only on the builder returned by `.select()`,
> and `count` is only settable as `select(..., count="exact")`. Calling
> `.order()` on the bare `table()` result raises
> `AttributeError: 'SyncRequestBuilder' object has no attribute 'order'` — so
> each endpoint must pass `count="exact"` at its own select call site.

### B. Wire into `backend/app/api/routes/admin.py`

Each of the six list endpoints changes to:
1. Add `params: PaginationParams = Depends()` (FastAPI binds `page`/`page_size`
   query params automatically).
2. Build the existing query the normal supabase-py way — `table(...).select(
   "<columns>", count="exact")` then filters/order — **without** a trailing
   `.execute()` (select carries the count flag, per the API constraint above).
3. `result = paginate(query, params)`, then return
   `{"<existing_key>": result.pop("items"), **result}` so the previous shape is
   preserved and metadata added.

Example (list_caregivers):
```python
@router.get("/caregivers")
def list_caregivers(
    status_filter: Optional[str] = Query(None, alias="status"),
    params: PaginationParams = Depends(),
    user: dict = Depends(require_admin),
):
    supabase = get_supabase()
    query = supabase.table("caregiver_applications").select(
        "*, caregivers(first_name, last_name, phone, address, ssn_last4), states(code, name, slug)",
        count="exact",
    )
    if status_filter:
        query = query.eq("status", status_filter)
    result = paginate(query.order("created_at", desc=True), params)
    return {"applications": result.pop("items"), **result}
```

Apply the same pattern to: `list_admin_documents` (`documents`), `list_admin_clients`
(`clients`), `list_admin_authorizations` (`authorizations`),
`list_audit_logs` (`audit_logs` — note it already uses `.limit(50)`; replace that
with pagination so `page_size` governs it), `list_announcements` (`announcements`).

### C. Test fixture — `backend/tests/conftest.py`

`FakeQuery` must learn `range()` (inclusive end) so tests can exercise paging:
```python
def range(self, start, end):           # inclusive, mimics PostgREST
    self.limit_n = end - start + 1
    self._offset = start
    return self
```
and apply `rows = rows[self._offset:]` before the existing `limit_n` slice in
`execute()`. Important: compute `total = len(rows)` **before** slicing so the
count flag reports the full matched set, not the current page.
`select("*", count="exact")` already maps to `count_mode`, so the existing
`count` plumbing is reused unchanged.

### D. Tests — `backend/tests/test_pagination.py` (new)

- Defaults: no `page`/`page_size` → `page=1, page_size=20`; entries zero-padded
  rows kept; `pages` computed from `total`.
- Full flow: seed `> page_size` applications in `db["caregiver_applications"]`
  (with ordering fields) → `GET /api/v1/admin/caregivers?page=2&page_size=5` →
  assert `total == N`, `len(items) == 5`, `page == 2`, `page_size == 5`.
- Bounds: `page_size=1000` → `422` (le=100); `page=0` → `422`.
- Over-range page: `page` beyond total → `items == []`, `pages` still correct.
- Regression: existing admin/caregiver tests stay green (response keeps the
  original list key).

## Migration (companion, from SCALING_CHECKLIST Tier 1)

Not required for this plan but recommended next:

```sql
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON caregiver_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_status_created ON caregiver_applications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_status_uploaded ON documents(status, uploaded_at);
```

## Verification

- `.\venv\Scripts\python.exe -m pytest -q` — existing 24 + new pagination tests green.
- `.\venv\Scripts\python.exe -m compileall -q app tests`
- Manual smoke: `GET /api/v1/admin/caregivers?page=2&page_size=5` returns bounded
  `items` + correct `total/page/pages`; `?page_size=1000` returns 422.

## File map

- `backend/app/utils/pagination.py` (new)
- `backend/app/api/routes/admin.py` (6 list endpoints)
- `backend/tests/conftest.py` (FakeQuery.range)
- `backend/tests/test_pagination.py` (new)

## Notes

`specs/README.md` lists `01–05-*.md` files that do not exist in the repo; this
plan intentionally follows the real convention (`plans/NNN_*.md`, see `018`).