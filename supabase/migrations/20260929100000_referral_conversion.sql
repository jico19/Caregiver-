-- ============================================================
-- Referral Conversion (Plan 004)
-- Adds assigned_to, handled_notes, and converted_client_id
-- ============================================================

ALTER TABLE public.client_referrals
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS handled_notes TEXT,
  ADD COLUMN IF NOT EXISTS converted_client_id UUID REFERENCES public.clients(id);

CREATE INDEX IF NOT EXISTS idx_referrals_assigned ON public.client_referrals(assigned_to);
