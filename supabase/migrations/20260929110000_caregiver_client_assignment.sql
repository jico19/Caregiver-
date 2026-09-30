-- Migration: 20260929110000_caregiver_client_assignment.sql
-- Description: Caregiver to client assignments and scheduled caregiver columns

ALTER TABLE care_plans
  ADD COLUMN IF NOT EXISTS caregiver_id UUID REFERENCES caregivers(id);

ALTER TABLE care_schedules
  ADD COLUMN IF NOT EXISTS caregiver_id UUID REFERENCES caregivers(id);

ALTER TABLE authorizations
  ADD COLUMN IF NOT EXISTS caregiver_id UUID REFERENCES caregivers(id);

CREATE TABLE IF NOT EXISTS caregiver_client_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  role         VARCHAR(40) NOT NULL DEFAULT 'primary',
  assigned_by  UUID NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  CONSTRAINT unique_active_caregiver_client UNIQUE (caregiver_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_caregiver ON caregiver_client_assignments(caregiver_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_client    ON caregiver_client_assignments(client_id)    WHERE ended_at IS NULL;
