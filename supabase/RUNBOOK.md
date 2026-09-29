# Database Runbook

Schema changes go through the **Supabase CLI**. `supabase/migrations/` is the
single source of truth for schema; `supabase/seeds/` holds demo data.

```
supabase/
  config.toml            linked to the live project
  migrations/            applied to production by `supabase db push`
  seeds/                 demo data, applied by hand to a disposable database
```

Every file in `migrations/` is re-runnable: applying it twice is a no-op, and
applying it to a partially-migrated database is safe.

## Making a schema change

1. Create a migration:

   ```powershell
   npx supabase migration new add_caregiver_rating
   ```

2. Edit the generated `supabase/migrations/<timestamp>_add_caregiver_rating.sql`.
   Do not edit a migration that has already been pushed — add a new one.

3. Apply to production. There is **no local database** in this workflow (see
   below), so a push is not pre-flighted by a local run:

   ```powershell
   npx supabase db push --dry-run   # prints the SQL; change nothing
   npx supabase db push
   ```

`db push` records each applied version in `supabase_migrations.schema_migrations`
on the remote, so the same version is never applied twice.

## There is no local database

Docker Desktop is not installed and is not part of this setup. That rules out
`supabase start`, `supabase db reset`, and `supabase db diff` — all of which
need a local Postgres container.

The consequence is deliberate and must be respected: **a migration is verified
against production or not at all.** Two rules follow.

- Read `--dry-run` output before every push. It is the only pre-flight.
- Write forward-only. A mistake on production is corrected by a new
  migration, not by editing history.

Backend tests do not cover SQL. `pytest` runs against the in-memory
`FakeSupabase`, so a migration that compiles can still be wrong.

## Applying seeds

Seeds are **never** applied by `db push`. They are demo data: test logins,
the nine careers, and the demo care plans. Apply them by hand when a
disposable database is needed — the Supabase SQL Editor against a scratch
project, or `psql` against any Postgres that has the schema loaded. Files are
ordered by their numeric prefix and must stay in that order:

| # | File | Provides |
|---|------|----------|
| 1 | `seeds/01_core.sql` | states, roles, document types, careers, test accounts |
| 2 | `seeds/02_document_requirements.sql` | per-state requirement matrix |
| 3 | `seeds/03_care_plan_demo.sql` | demo care plans, activities, schedules |

Migrations run before seeds, so a migration can never depend on seeded rows.
That is why the data half of the old `08`, `12`, and `13` lives in `seeds/`
rather than in a migration.

### The seed password

`01_core.sql` inserts `auth.users` rows and aborts unless a password has been
set in the session first. No password is committed to this repository. Supply
one from your shell in a single psql session:

```powershell
psql $env:TARGET_DB_URL -v ON_ERROR_STOP=1 `
  -c "select set_config('app.seed_pwd','your-strong-password',false)" `
  -f supabase/seeds/01_core.sql
```

In the SQL Editor, run `SELECT set_config('app.seed_pwd', '<password>', false);`
in the same query as the file's contents.

## Baseline: how the remote got its history

Everything in `migrations/` was originally applied by hand through the SQL
Editor, so the remote had no migration history. The remote was backfilled by
marking all baseline versions as applied without executing them:

```powershell
npx supabase migration repair --status applied `
  20260924101138 20260924101200 20260924101300 20260924101400 20260924101500 `
  20260924101600 20260924101700 20260924101800 20260924101900 --linked
```

Check the result at any time:

```powershell
npx supabase migration list
```

`db diff` is the usual way to confirm a migration file matches what is
deployed, but it needs Docker for a shadow database and is therefore not
available here. Confirm a schema change by querying the remote with the
checks in the verification section below.

## Rollback

`db push` has no automatic down-migration. If a pushed migration turns out to
be wrong:

1. Write a **new** migration that reverses it, and push that. This keeps the
   history linear and is the only option once a migration has been applied.
2. If the damage is live and must be undone before you can write the reversal,
   repair the history to match reality, then push the reversal:

   ```powershell
   npx supabase migration repair --status reverted <version> --linked
   ```

3. Restore from a backup as a last resort. The Dashboard → Database → Backups
   section is the only source of point-in-time recovery here; there is no
   dump taken by this process.

## Verifying production after a change

```sql
-- roles present (super_admin must be last, id 5)
SELECT id, name FROM roles ORDER BY id;

-- the seeded admin is a super_admin
SELECT u.email, r.name AS role, u.state_id
FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name IN ('administrator', 'super_admin');

-- no administrator left without a state (each must be fixed or promoted)
SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name = 'administrator' AND u.state_id IS NULL;

-- exactly 9 job postings, one per (state, title)
SELECT state_id, count(*) FROM job_postings GROUP BY state_id ORDER BY state_id;

-- the private documents bucket exists
SELECT id, name, public FROM storage.buckets WHERE name = 'documents';

-- RLS policies that exist
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename;
```

## Traps this directory used to contain

Kept here so they are not reintroduced:

- **`CREATE TRIGGER` has no `IF NOT EXISTS` in Postgres.** Sixteen of them in
  the initial schema plus three in the migrations threw *trigger already
  exists* on every re-run. Each is now preceded by `DROP TRIGGER IF EXISTS`.
- **`CREATE INDEX` also lacked `IF NOT EXISTS`** in 37 places, throwing
  *relation already exists*. All are guarded now.
- **The old job-postings seed and `seed_careers.sql` were duplicates** and
  inserted the 9 postings twice. Both dedupe on `(state_id, title)`, which a
  unique index enforces, so the second is now a no-op.
- **The old documented order ran the migrations *after* the seed.** Under the
  CLI, migrations always run first. Seeded data that a migration needed was
  moved into `seeds/`.

## State authorization

`20260924101900_super_admin_state_scoping.sql` introduces the model the backend
enforces (see `backend/app/core/dependencies.py`):

- `super_admin` — `users.state_id IS NULL`, access to every state.
- `administrator` — access limited to `users.state_id`.
- An `administrator` with `state_id IS NULL` is **denied everything**
  (fail-closed), not treated as cross-state. The third query above finds them.

Note that the RLS policies still test `app_has_role('administrator')` and do
not know about `super_admin`. This is harmless while the backend uses the
service-role key (which bypasses RLS), but a `super_admin` querying through
the anon or `authenticated` role would be rejected by RLS.
