-- ============================================================
-- Client Admission Lifecycle (Plan 003)
-- Adds lifecycle status, service start date, reviewer audit,
-- admission notes, and rejection reason.
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','active','discharged','rejected')),
  ADD COLUMN IF NOT EXISTS service_start_date DATE,
  ADD COLUMN IF NOT EXISTS admitted_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admission_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_start   ON public.clients(service_start_date);
