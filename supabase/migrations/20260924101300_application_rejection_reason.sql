-- ============================================================
-- Caregiver applications: dedicated rejection reason column
-- Candidate's `notes` (experience narrative) should not be
-- overwritten by the reviewer's rejection note.
-- ============================================================

ALTER TABLE caregiver_applications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;