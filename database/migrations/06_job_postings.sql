-- ============================================================
-- Migration: 06_job_postings.sql
-- Create job_postings table and seed state-specific careers
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS job_postings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id     INTEGER NOT NULL REFERENCES states(id),
  title        VARCHAR(200) NOT NULL,
  job_type     VARCHAR(100) NOT NULL,
  compensation VARCHAR(100) NOT NULL,
  requirements TEXT,
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_state ON job_postings(state_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_active ON job_postings(active);

CREATE TRIGGER job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_postings' AND policyname = 'Allow public read active job postings'
  ) THEN
    CREATE POLICY "Allow public read active job postings"
      ON job_postings
      FOR SELECT
      USING (active = TRUE);
  END IF;
END $$;

-- ============================================================
-- SEED DATA: State-specific Careers
-- ============================================================

-- Florida (state_id = 1)
INSERT INTO job_postings (state_id, title, job_type, compensation, requirements, description, sort_order)
VALUES
  (
    1,
    'Certified Nursing Assistant (CNA)',
    'Full-Time / Part-Time',
    '$19 - $23 / hour',
    'Active Florida CNA certification in good standing, CPR/BLS certification, AHCA Level 2 background screening cleared.',
    'Provide compassionate hands-on personal care, assistance with ADLs, vital signs monitoring, and mobility support for home care patients across Florida.',
    1
  ),
  (
    1,
    'Home Health Aide (HHA)',
    'Flexible Hours / PRN',
    '$17 - $20 / hour',
    'Florida 75-hour HHA certificate or active CNA license, valid driver license, negative TB screening within last 12 months.',
    'Assist clients with daily living routines, meal preparation, medication reminders, companionship, and light housekeeping.',
    2
  ),
  (
    1,
    'Personal Care Attendant (PCA)',
    'Day / Evening Shifts',
    '$16 - $19 / hour',
    'High school diploma or GED, reliable transportation, clean driving record, cleared background screening.',
    'Support senior clients with homemaking, grocery shopping, routine transportation, and companionship in community residences.',
    3
  ),

-- Indiana (state_id = 2)
  (
    2,
    'Certified Nursing Assistant (CNA)',
    'Full-Time / Part-Time',
    '$18 - $22 / hour',
    'Active Indiana Nurse Aide Registry certification, CPR certification, Indiana state police background check.',
    'Deliver personal care, hygiene support, patient transfer, and health monitoring for Indiana Medicaid waiver clients.',
    1
  ),
  (
    2,
    'Home Health Aide (HHA)',
    'Part-Time / Weekend',
    '$17 - $20 / hour',
    'State-approved HHA competency certificate or CNA license, Indiana driver license, current TB clearance.',
    'Provide in-home personal care, companion care, mobility support, and meal preparation for seniors across Indiana.',
    2
  ),
  (
    2,
    'Direct Support Professional (DSP)',
    'Full-Time',
    '$16 - $19 / hour',
    'High school diploma or GED, valid Indiana driver license, CPR/First Aid certification.',
    'Assist individuals with intellectual and developmental disabilities in home and community settings under Indiana CIH / FSW waivers.',
    3
  ),

-- Georgia (state_id = 3)
  (
    3,
    'Certified Nursing Assistant (CNA)',
    'Full-Time / PRN',
    '$18 - $22 / hour',
    'Georgia Nurse Aide Registry certification in good standing, CPR/AED certification, Georgia criminal background clearance.',
    'Deliver essential nursing assistant duties, vital signs recording, personal care, and patient assistance throughout Georgia.',
    1
  ),
  (
    3,
    'Certified Medication Aide (CMA)',
    'Full-Time',
    '$19 - $23 / hour',
    'Georgia CMA certification, active CNA license, CPR certification, clean background check.',
    'Administer prescribed medications, observe and document patient responses, and coordinate with supervising registered nurses.',
    2
  ),
  (
    3,
    'Personal Care Assistant (PCA)',
    'Flexible Shifts',
    '$16 - $18 / hour',
    'Georgia PCA certification or passing state competency exam, reliable transportation, clean driving record.',
    'Support clients with ADLs, personal grooming, meal preparation, and respite care under Georgia CCSP and SOURCE programs.',
    3
  );
