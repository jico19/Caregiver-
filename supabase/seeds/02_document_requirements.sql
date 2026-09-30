-- ============================================================
-- Per-state document requirement matrix
--
-- Every state requires every caregiver document type except the "Other"
-- catch-all, and every client document type except "Other".
-- Depends on the states and document_types inserted by 01_core.sql.
-- ============================================================

INSERT INTO document_requirements (state_id, document_type_id, required, for_role)
SELECT s.id, dt.id, TRUE, 'caregiver'
FROM states s
JOIN document_types dt
  ON dt.for_role = 'caregiver'
 AND dt.name <> 'Other'
ON CONFLICT (state_id, document_type_id) DO NOTHING;

INSERT INTO document_requirements (state_id, document_type_id, required, for_role)
SELECT s.id, dt.id, TRUE, 'client'
FROM states s
JOIN document_types dt
  ON dt.for_role = 'client'
 AND dt.name <> 'Other'
ON CONFLICT (state_id, document_type_id) DO NOTHING;
