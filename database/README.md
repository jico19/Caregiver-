# Database Setup

## Steps

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Paste and run `schema.sql` first
4. Paste and run `seed.sql` second
5. Paste and run `seed_careers.sql` third (or when adding career openings)
6. Paste and run the migrations in `migrations/` (in numeric order: `06_` → `07_` → `08_` → `09_` → `10_`)

`09_documents_bucket.sql` provisions the private `documents` Storage bucket the
backend uploads files to; `10_rls_policies.sql` adds Row Level Security policies
matching the app's access model (own-row for users, admin override, public read
for content tables). Both are idempotent.

### Security model (read this before touching RLS)

All application traffic goes through the FastAPI backend using the **service-role**
key, which bypasses RLS. RLS policies are **defense in depth** — they bound what the
Data API roles (`anon`/`authenticated`) could read/write if a Supabase client were
ever added, and they protect the data if the service-role key leaks. Never weaken
these policies to make a client-side call work; extend the backend instead.

### Seeding test accounts (`seed.sql`)

No password is committed to this repository. Before running `seed.sql`,
set the seed password in the SQL Editor so the script can create the test
accounts:

```sql
SELECT set_config('app.seed_pwd', 'your-strong-password', false);
```

Then run `seed.sql`. It will abort with a clear error if you skip this step.
The same password can be supplied to `backend/seed_accounts.py` via the
`SEED_TEST_PASSWORD` environment variable.


## Notes

- Schema uses Supabase `auth.users` as the identity layer
- Application `users` table extends `auth.users` with role and state
- All tables have RLS enabled — policies are added per feature
- Never store passwords in the `users` table; Supabase Auth handles that
