# Deployment Guide: Fly.io Self-Hosted HIPAA Architecture (Option A)

This guide provides a step-by-step process for deploying the Caregiver platform entirely onto Fly.io under a single Business Associate Agreement (BAA).

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         Fly.io HIPAA Organization        |
                      |                 ($100/mo)                |
                      |                                          |
                      |  +----------------+                      |
                      |  | React Frontend | (Public Web)         |
                      |  +-------+--------+                      |
                      |          |                               |
                      |          v                               |
                      |  +----------------+                      |
                      |  | FastAPI Backend|                      |
                      |  +-------+--------+                      |
                      |          | (Fly Internal Private Network)|
                      |          v                               |
                      |  +------------------------------------+  |
                      |  | Self-Hosted Supabase Stack         |  |
                      |  | - PostgreSQL (Encrypted Fly Volume)|  |
                      |  | - GoTrue (Auth)                    |  |
                      |  | - PostgREST (API)                  |  |
                      |  | - Storage (Files / Care Plans)     |  |
                      |  +------------------------------------+  |
                      +------------------------------------------+
```

* **Legal Scope:** All components live inside Fly.io; all ePHI is covered under Fly's signed BAA.
* **Cost Profile:** Fly compute resources + $100/mo HIPAA compliance add-on (avoids Supabase Cloud $599/mo tier).

---

## Phase 1: Prerequisites & Compliance Setup

### Step 1.1: Install CLI Tools
Ensure the following tools are installed on your machine:
```powershell
# Install flyctl
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Verify Node.js and Supabase CLI
node -v
npx supabase --version
```

### Step 1.2: Enable Fly.io HIPAA Plan & Sign BAA
1. Log in to [Fly.io Dashboard](https://fly.io/dashboard).
2. Create or select a dedicated production organization (e.g., `caregiver-prod`).
3. Navigate to **Organization Settings** > **Compliance**.
4. Select the **HIPAA Compliance Add-on** ($100/mo).
5. Review and digitally execute the **Business Associate Agreement (BAA)** with Fly.io.

---

## Phase 2: Deploy Self-Hosted Supabase Stack (Official Docker)

Following the [Supabase Official Docker Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting/docker):

### Step 2.1: System Requirements & Sizing
Per official Supabase specs for self-hosted instances:
* **RAM:** Minimum 4 GB (Recommended 8 GB+)
* **CPU:** Minimum 2 cores (Recommended 4 cores+)
* **Disk:** Minimum 40 GB SSD (Recommended 80 GB+ SSD)
* **Fly VM recommendation:** `performance-2x` (2 dedicated vCPUs, 4GB RAM) or `standard-4x` (4 vCPUs, 8GB RAM).

### Step 2.2: Fetch Official Docker Configuration
On your deployment server or build directory:
```bash
# Clone the pinned self-hosted release
git clone --depth 1 --branch self-hosted/v0.8.2 https://github.com/supabase/supabase

# Copy configuration files into your deployment folder
mkdir supabase-project
cp -rf supabase/docker/. supabase-project
cd supabase-project
cp .env.example .env
```

### Step 2.3: Generate Secure Keys & Credentials
Run Supabase's built-in key generation scripts (never start with default `.env.example` secrets):
```bash
# 1. Generate core secrets and database password
sh utils/generate-keys.sh

# 2. Generate asymmetric JWT keys & API keys (Publishable & Secret keys)
sh utils/add-new-auth-keys.sh
```

Inspect the generated values at any time using:
```bash
sh run.sh secrets
```

### Step 2.4: Configure URLs & Service Endpoints
In `supabase-project/.env`, set:
* `SUPABASE_PUBLIC_URL`: `https://supabase.yourdomain.com:8000` (or `http://caregiver-supabase-prod.internal:8000`)
* `API_EXTERNAL_URL`: `https://supabase.yourdomain.com:8000/auth/v1`
* `SITE_URL`: `https://app.yourdomain.com` (your frontend app)
* `DASHBOARD_USERNAME`: Choose admin username
* `DASHBOARD_PASSWORD`: Strong password (letters required) for Supabase Studio

### Step 2.5: Provision Persistent Volumes on Fly.io
Ensure persistent data is preserved across container restarts:
```powershell
# 40GB encrypted volume for Postgres & Supabase components on Fly
fly volumes create supabase_data --size 40 --region ord --org caregiver-prod
```

### Step 2.6: Start the Supabase Stack
Start all services (PostgreSQL, Envoy API gateway, GoTrue Auth, PostgREST, Storage, Studio):
```bash
sh run.sh start
```
*(Equivalent to `docker compose up -d --wait`)*

Verify all containers are healthy:
```bash
docker compose ps
```
All core services should report `Up [...] (healthy)`.

---

## Phase 3: Run Database Migrations

Once the Fly Postgres database is running, apply all platform migrations.

### Step 3.1: Open WireGuard Tunnel or Use Direct Connection
Create a secure tunnel to reach the private Fly database from your workstation:
```powershell
fly proxy 5433:5432 -a caregiver-supabase-prod
```

### Step 3.2: Apply Migrations
From the repository root, push all migrations in `supabase/migrations/`:
```powershell
npx supabase db push --db-url "postgresql://postgres:<PASSWORD>@localhost:5433/postgres"
```

### Step 3.3: Verify Schema & Indexes
Verify that tables, roles, and partial composite indexes are active:
- `clients`, `caregivers`, `authorizations`, `in_service_courses`
- Composite indexes: `(state_id, <sort_col>) WHERE deleted_at IS NULL`
- `audit_logs` table and retention policies

---

## Phase 4: Deploy FastAPI Backend

### Step 4.1: Prepare Backend Configuration
Create a production `fly.toml` inside `backend/`:

```toml
app = "caregiver-api-prod"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8000"
  ALLOWED_ORIGINS = "https://app.yourdomain.com"
  SUPABASE_URL = "http://caregiver-supabase-prod.internal:8000"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1
```

### Step 4.2: Set Production Secrets
Inject sensitive keys directly into Fly's encrypted secrets store (never commit these to Git):
```powershell
cd backend
fly secrets set `
  SUPABASE_KEY="<SERVICE_ROLE_KEY>" `
  SUPABASE_ANON_KEY="<ANON_KEY>" `
  JWT_SECRET="<JWT_SECRET>" `
  --app caregiver-api-prod
```

### Step 4.3: Deploy Backend
```powershell
fly deploy --app caregiver-api-prod
```

---

## Phase 5: Deploy Frontend (React + Vite)

### Step 5.1: Build Configuration
Set production environment variables pointing to the Fly backend:
```env
VITE_API_BASE_URL=https://caregiver-api-prod.fly.dev/api/v1
VITE_SUPABASE_URL=https://caregiver-supabase-prod.fly.dev
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
```

### Step 5.2: Deploy
Choose one of the following:
* **Option 1 (Inside Fly.io):** Deploy as a static Nginx container via `fly deploy` under the same organization.
* **Option 2 (Static CDN):** Deploy static build (`npm run build`) to Cloudflare Pages or Vercel (static frontends contain zero server-side PHI; all sensitive data travels directly between client browser and Fly backend over HTTPS).

---

## Phase 6: Post-Deployment Verification & Operational Hardening

### Step 6.1: Verify Live Endpoints
Run smoke tests against the deployed API:
```powershell
curl -I https://caregiver-api-prod.fly.dev/health
```

### Step 6.2: Configure Automated Encrypted Backups
Under HIPAA, data availability and disaster recovery are legally required:
1. Schedule a daily database dump job using a lightweight Fly machine with `cron` or Fly scheduled tasks.
2. Encrypt backups using GPG or age before transmission:
   ```bash
   pg_dump -U postgres postgres | gzip | gpg -c -o backup-$(date +%F).sql.gz.gpg
   ```
3. Store encrypted backups in an encrypted Fly volume or an AWS S3 bucket with a signed AWS BAA.

### Step 6.3: Verify Audit Logging
Log in as an administrator, view a client record, and confirm an entry is generated in `audit_logs` without exposing raw medical blobs in server logs.
