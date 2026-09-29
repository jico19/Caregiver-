-- ============================================================
-- Per-state document requirement matrix
--
-- Every state requires every caregiver document type except the "Other"
-- catch-all. Depends on the states and document_types inserted by
-- 01_core.sql, so it must run after it.
-- ============================================================

INSERT INTO document_requirements (state_id, document_type_id, required)
SELECT s.id, dt.id, TRUE
FROM states s
JOIN document_types dt
  ON dt.for_role = 'caregiver'
 AND dt.name <> 'Other'
ON CONFLICT (state_id, document_type_id) DO NOTHING;
