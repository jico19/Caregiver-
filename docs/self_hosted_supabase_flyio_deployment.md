# Self-Hosted Supabase on Fly.io (HIPAA-Compliant Deployment Guide)

This guide walks through deploying a dedicated, self-hosted Supabase stack and the Caregiver application on Fly.io under a signed HIPAA Business Associate Agreement (BAA).

**Estimated completion time:** 60–75 minutes.  
**Estimated monthly cost:** ~$99/mo (Fly BAA) + ~$40–$55/mo (Fly VMs and encrypted NVMe storage).

---

## Architecture Overview

```
                         Internet (HTTPS / TLS 1.3)
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
    ┌─────────────────────────┐             ┌─────────────────────────┐
    │     Frontend App        │             │      FastAPI Backend    │
    │   (React 19 / Vite)     │             │    (Python 3.12 / Fly)  │
    └────────────┬────────────┘             └────────────┬────────────┘
                 │                                       │
                 │   Auth & Storage API calls            │ Database queries
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    Self-Hosted Supabase     │
                      │     (Fly Machine App)       │
                      │ ┌─────────────────────────┐ │
                      │ │  Kong API Gateway :8000 │ │
                      │ └──────┬──────────┬───────┘ │
                      │        │          │         │
                      │   ┌────▼───┐  ┌───▼────┐    │
                      │   │ GoTrue │  │Storage │    │
                      │   │ (Auth) │  │  API   │    │
                      │   └────┬───┘  └───┬────┘    │
                      │        │          │         │
                      │ ┌──────▼──────────▼───────┐ │
                      │ │    PostgreSQL 15        │ │
                      │ │  + RLS & Audit Triggers │ │
                      │ └────────────┬────────────┘ │
                      │              │              │
                      │ ┌────────────▼────────────┐ │
                      │ │ Encrypted NVMe Volume   │ │
                      │ │    (/var/lib/postgresql)│ │
                      │ └─────────────────────────┘ │
                      └─────────────────────────────┘
```

---

## Step 1: Legal & Account Gate (HIPAA BAA)

> [!IMPORTANT]
> You must sign the BAA before deploying any database containing Electronic Protected Health Information (ePHI).

1. Install Fly.io CLI (`flyctl`):
   ```powershell
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
2. Log in to your Fly account:
   ```bash
   fly auth login
   ```
3. Open Fly Organization Settings in your browser:
   * Navigate to `https://fly.io/dashboard` -> Select Organization -> **Settings** -> **Compliance**.
   * Review and sign the **Fly.io Business Associate Agreement (BAA)**.
   * Verify the status shows **Active** ($99/mo).

---

## Step 2: Prepare Supabase Docker Configuration

1. In a separate working folder (outside the git root or in an infrastructure repo):
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase.git supabase-deploy
   cd supabase-deploy/docker
   cp .env.example .env
   ```

2. Generate secure random secrets (run in PowerShell or Bash):
   * Generate 64-character random strings for:
     * `POSTGRES_PASSWORD`
     * `JWT_SECRET`
     * `SECRET_KEY_BASE`
     * `VAULT_ENC_KEY`
   * Example PowerShell generator:
     ```powershell
     -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | ForEach-Object {[char]$_})
     ```

3. Generate `ANON_KEY` and `SERVICE_ROLE_KEY`:
   Supabase uses JWTs signed with `JWT_SECRET`. Run the Supabase token generator or Node snippet:
   ```bash
   # From supabase-deploy/docker:
   npx ts-node -e "
     const jwt = require('jsonwebtoken');
     const secret = 'YOUR_JWT_SECRET';
     console.log('ANON:', jwt.sign({ role: 'anon', iss: 'supabase' }, secret, { expiresIn: '10y' }));
     console.log('SERVICE:', jwt.sign({ role: 'service_role', iss: 'supabase' }, secret, { expiresIn: '10y' }));
   "
   ```

4. Populate `.env`:
   * `POSTGRES_PASSWORD=<generated-postgres-password>`
   * `JWT_SECRET=<generated-jwt-secret>`
   * `ANON_KEY=<generated-anon-key>`
   * `SERVICE_ROLE_KEY=<generated-service-role-key>`
   * `SITE_URL=https://caregiver.yourdomain.com`
   * `API_EXTERNAL_URL=https://caregiver-supabase.fly.dev`

---

## Step 3: Provision Encrypted Storage & Fly Supabase App

HIPAA Security Rule requires encryption at rest. Fly volumes support AES-256 encryption.

1. Create the Fly application for Supabase:
   ```bash
   fly apps create caregiver-supabase --org <your-org>
   ```

2. Create an encrypted NVMe volume (20 GB minimum recommended):
   ```bash
   fly volumes create supabase_data --size 20 --region atl --encrypted
   ```

3. Create `fly.toml` inside `supabase-deploy/docker`:
   ```toml
   app = "caregiver-supabase"
   primary_region = "atl"

   [build]
     dockerfile = "Dockerfile"

   [mounts]
     source = "supabase_data"
     destination = "/var/lib/postgresql/data"

   [[vm]]
     size = "shared-cpu-2x"
     memory = "4096mb"

   [[services]]
     protocol = "tcp"
     internal_schema = "http"
     processes = ["app"]

     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]

     [[services.ports]]
       port = 80
       handlers = ["http"]

     [[services.ports]]
       port = 5432
       handlers = ["pg_tls"]

     [services.concurrency]
       type = "connections"
       hard_limit = 200
       soft_limit = 150
   ```

4. Deploy Supabase to Fly.io:
   ```bash
   fly deploy
   ```

5. Verify running status:
   ```bash
   fly status
   ```
   Confirm health checks pass at `https://caregiver-supabase.fly.dev/health`.

---

## Step 4: Apply Database Schema & Migrations

Now apply the repository's migrations (`supabase/migrations/`) to your new self-hosted Postgres instance.

1. Form your connection string:
   ```
   postgres://postgres:<POSTGRES_PASSWORD>@caregiver-supabase.fly.dev:5432/postgres
   ```

2. Test connection with CLI dry run:
   ```bash
   npx supabase db push --db-url "postgres://postgres:<POSTGRES_PASSWORD>@caregiver-supabase.fly.dev:5432/postgres" --dry-run
   ```

3. Apply forward-only migrations:
   ```bash
   npx supabase db push --db-url "postgres://postgres:<POSTGRES_PASSWORD>@caregiver-supabase.fly.dev:5432/postgres"
   ```

4. Verify migration status:
   * Ensure all migrations up to current are marked applied.
   * Tables `clients`, `caregivers`, `audit_logs`, `users` are verified with RLS enabled.

---

## Step 5: Deploy FastAPI Backend to Fly.io

1. From `backend/` in this repository, launch a Fly app:
   ```bash
   cd backend
   fly launch --name caregiver-api --region atl --no-deploy
   ```

2. Configure backend environment secrets on Fly:
   ```bash
   fly secrets set \
     SUPABASE_URL="https://caregiver-supabase.fly.dev" \
     SUPABASE_KEY="<ANON_KEY>" \
     SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
     JWT_SECRET="<JWT_SECRET>" \
     ENVIRONMENT="production"
   ```

3. Deploy backend:
   ```bash
   fly deploy
   ```

4. Verify backend health endpoint:
   ```bash
   curl -I https://caregiver-api.fly.dev/health
   ```

---

## Step 6: Deploy React Frontend

1. In `frontend/`, configure production environment variables:
   * `VITE_API_URL=https://caregiver-api.fly.dev`
   * `VITE_SUPABASE_URL=https://caregiver-supabase.fly.dev`
   * `VITE_SUPABASE_ANON_KEY=<ANON_KEY>`

2. Build and verify static bundle:
   ```powershell
   npm.cmd run build
   ```

3. Deploy via Fly.io static app or preferred secure CDN (e.g., Fly Machine with Nginx / static):
   ```bash
   cd frontend
   fly launch --name caregiver-web --region atl
   fly deploy
   ```

---

## Step 7: HIPAA Production Verification Checklist

Run these checks before putting live patient or caregiver data into the system:

- [ ] **BAA Active**: Fly.io compliance portal displays signed BAA for the target organization.
- [ ] **Encryption in Transit**: All endpoints (`caregiver-web`, `caregiver-api`, `caregiver-supabase`) enforce TLS 1.2+ with automatic HTTP -> HTTPS redirects.
- [ ] **Encryption at Rest**: `fly volumes list` shows `--encrypted` true on `supabase_data`.
- [ ] **Audit Trail**: Test inserting a dummy record; confirm an entry appears in `audit_logs`.
- [ ] **Access Isolation**: Test an administrator login from Florida; confirm records from Indiana and Georgia return 403 / are omitted.
- [ ] **Backups**: Configure automated snapshots via Fly CLI:
  ```bash
  fly volumes snapshots list supabase_data
  ```

---

## Rollback & Emergency Procedures

If a critical issue occurs during deployment:

1. **Rollback Fly App version**:
   ```bash
   fly releases -a caregiver-supabase
   fly deploy --image <previous-image-tag>
   ```
2. **Database Snapshot Restore**:
   ```bash
   fly volumes create supabase_data --snapshot-id <snapshot_id> --encrypted
   ```
3. **Secret Revocation**:
   If keys are leaked, update `JWT_SECRET` in both `caregiver-supabase` and `caregiver-api` secrets, and re-issue `ANON_KEY` and `SERVICE_ROLE_KEY`.
