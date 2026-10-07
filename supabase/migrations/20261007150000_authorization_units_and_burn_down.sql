-- Migration: 20261007150000_authorization_units_and_burn_down.sql
-- Description: Add procedure code, units, weekly hours cap, and balance tracking to authorizations

ALTER TABLE authorizations
    ADD COLUMN IF NOT EXISTS hcpcs_code VARCHAR(20) NOT NULL DEFAULT 'T1019',
    ADD COLUMN IF NOT EXISTS service_description VARCHAR(150) NOT NULL DEFAULT 'Personal Care Services',
    ADD COLUMN IF NOT EXISTS total_units_authorized INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS units_used INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_weekly_hours NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) NOT NULL DEFAULT '15_min';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authorizations_unit_type_check'
  ) THEN
    ALTER TABLE authorizations
      ADD CONSTRAINT authorizations_unit_type_check
      CHECK (unit_type IN ('15_min', 'hourly', 'visit'));
  END IF;
END $$;
