-- Migration: Training reminders and client document requirements
ALTER TABLE training_courses
  ADD COLUMN IF NOT EXISTS validity_months INTEGER;

ALTER TABLE training_enrollments
  ADD COLUMN IF NOT EXISTS due_at DATE;

CREATE INDEX IF NOT EXISTS idx_enrollments_due ON training_enrollments(due_at)
  WHERE status <> 'completed';

ALTER TABLE document_requirements
  ADD COLUMN IF NOT EXISTS for_role VARCHAR(20) NOT NULL DEFAULT 'caregiver'
    CHECK (for_role IN ('caregiver','client','both'));
