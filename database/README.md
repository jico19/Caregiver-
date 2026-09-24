# Database Setup

## Steps

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Paste and run `schema.sql` first
4. Paste and run `seed.sql` second
5. Paste and run `seed_careers.sql` third (or when adding career openings)

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
