-- ============================================================
-- Migration 09: documents Storage bucket
-- Provision the private 'documents' bucket used by the backend
-- (app/services/document_service.py) for caregiver/client uploads.
-- Buckets live in the `storage` schema, not `public`.
-- Run in Supabase SQL Editor
-- ============================================================

-- Create the private bucket (idempotent). No anon/authenticated policies are
-- added, so RLS default-deny applies: files are only reachable through the
-- service-role client, which issues short-lived signed URLs via the backend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  10485760, -- 10 MB, matches backend MAX_FILE_SIZE
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Scope object access to the service role only (defense in depth; no other
-- policy grants anon/authenticated any access to this bucket).
DROP POLICY IF EXISTS "p_documents_objects_service_role" ON storage.objects;
CREATE POLICY "p_documents_objects_service_role"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- ============================================================
-- Verify afterwards:
--   SELECT id, name, public FROM storage.buckets WHERE name = 'documents';
--   SELECT policyname FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects';
-- ============================================================