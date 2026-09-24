-- ============================================================
-- Seed Data — Run AFTER schema.sql
-- ============================================================

-- States
INSERT INTO states (code, name, slug) VALUES
  ('FL', 'Florida', 'florida'),
  ('IN', 'Indiana', 'indiana'),
  ('GA', 'Georgia', 'georgia')
ON CONFLICT (slug) DO NOTHING;

-- Roles
INSERT INTO roles (name, description) VALUES
  ('public',        'Unauthenticated public visitor'),
  ('caregiver',     'Caregiver applying for or employed by the agency'),
  ('client',        'Client receiving care services'),
  ('administrator', 'Agency staff with administrative access')
ON CONFLICT (name) DO NOTHING;

-- Document Types
INSERT INTO document_types (name, for_role, requires_expiration) VALUES
  ('Driver License',        'caregiver', TRUE),
  ('CPR Certificate',       'caregiver', TRUE),
  ('CNA/HHA Certificate',   'caregiver', TRUE),
  ('TB Test',               'caregiver', TRUE),
  ('Physical Exam',         'caregiver', TRUE),
  ('Background Check',      'caregiver', TRUE),
  ('Social Security Card',  'caregiver', FALSE),
  ('Auto Insurance',        'caregiver', TRUE),
  ('Driver Insurance',      'caregiver', TRUE),
  ('Direct Deposit Form',   'caregiver', FALSE),
  ('Insurance Card',        'client',    TRUE),
  ('Medicaid Document',     'client',    TRUE),
  ('Physician Orders',      'client',    TRUE),
  ('Plan of Care',          'client',    TRUE),
  ('Client Identification', 'client',    FALSE),
  ('Authorization Document','client',    TRUE)
ON CONFLICT (name) DO NOTHING;

-- Job Postings / Careers
INSERT INTO job_postings (state_id, title, job_type, compensation, requirements, description, sort_order) VALUES
  (1, 'Certified Nursing Assistant (CNA)', 'Full-Time / Part-Time', '$19 - $23 / hour', 'Active Florida CNA certification in good standing, CPR/BLS certification, AHCA Level 2 background screening cleared.', 'Provide compassionate hands-on personal care, assistance with ADLs, vital signs monitoring, and mobility support for home care patients across Florida.', 1),
  (1, 'Home Health Aide (HHA)', 'Flexible Hours / PRN', '$17 - $20 / hour', 'Florida 75-hour HHA certificate or active CNA license, valid driver license, negative TB screening within last 12 months.', 'Assist clients with daily living routines, meal preparation, medication reminders, companionship, and light housekeeping.', 2),
  (1, 'Personal Care Attendant (PCA)', 'Day / Evening Shifts', '$16 - $19 / hour', 'High school diploma or GED, reliable transportation, clean driving record, cleared background screening.', 'Support senior clients with homemaking, grocery shopping, routine transportation, and companionship in community residences.', 3),
  (2, 'Certified Nursing Assistant (CNA)', 'Full-Time / Part-Time', '$18 - $22 / hour', 'Active Indiana Nurse Aide Registry certification, CPR certification, Indiana state police background check.', 'Deliver personal care, hygiene support, patient transfer, and health monitoring for Indiana Medicaid waiver clients.', 1),
  (2, 'Home Health Aide (HHA)', 'Part-Time / Weekend', '$17 - $20 / hour', 'State-approved HHA competency certificate or CNA license, Indiana driver license, current TB clearance.', 'Provide in-home personal care, companion care, mobility support, and meal preparation for seniors across Indiana.', 2),
  (2, 'Direct Support Professional (DSP)', 'Full-Time', '$16 - $19 / hour', 'High school diploma or GED, valid Indiana driver license, CPR/First Aid certification.', 'Assist individuals with intellectual and developmental disabilities in home and community settings under Indiana CIH / FSW waivers.', 3),
  (3, 'Certified Nursing Assistant (CNA)', 'Full-Time / PRN', '$18 - $22 / hour', 'Georgia Nurse Aide Registry certification in good standing, CPR/AED certification, Georgia criminal background clearance.', 'Deliver essential nursing assistant duties, vital signs recording, personal care, and patient assistance throughout Georgia.', 1),
  (3, 'Certified Medication Aide (CMA)', 'Full-Time', '$19 - $23 / hour', 'Georgia CMA certification, active CNA license, CPR certification, clean background check.', 'Administer prescribed medications, observe and document patient responses, and coordinate with supervising registered nurses.', 2),
  (3, 'Personal Care Assistant (PCA)', 'Flexible Shifts', '$16 - $18 / hour', 'Georgia PCA certification or passing state competency exam, reliable transportation, clean driving record.', 'Support clients with ADLs, personal grooming, meal preparation, and respite care under Georgia CCSP and SOURCE programs.', 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TEST ACCOUNTS
-- ============================================================
-- SECURITY: No password is committed to this repository.
-- Set one before running this file (Supabase SQL Editor), e.g.:
--   SELECT set_config('app.seed_pwd', 'your-strong-password', false);
-- The block below aborts if no password is set.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  seed_pwd text := current_setting('app.seed_pwd', true);
BEGIN
  IF seed_pwd IS NULL OR seed_pwd = '' THEN
    RAISE EXCEPTION 'Seed password not set. Run: SELECT set_config(''app.seed_pwd'', ''your-password'', false); then run this file.';
  END IF;

  -- Auth users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', '3f9d1f38-b03e-466f-98bf-dab66163d63c', 'authenticated', 'authenticated', 'admin@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Admin","last_name":"Director"}'::jsonb, NOW(), NOW(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '26fecbcc-2b75-4770-86b3-95fd866a9b50', 'authenticated', 'authenticated', 'caregiver.fl@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Sarah","last_name":"Jenkins"}'::jsonb, NOW(), NOW(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', 'da6c3061-7845-4074-9dea-fd996bb91cc4', 'authenticated', 'authenticated', 'caregiver.in@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Michael","last_name":"Chang"}'::jsonb, NOW(), NOW(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '515aad09-c5b7-456a-8d4f-4cd03beaad09', 'authenticated', 'authenticated', 'caregiver.ga@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Jessica","last_name":"Williams"}'::jsonb, NOW(), NOW(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '90034b85-5667-4261-ac11-f3de38acc1c9', 'authenticated', 'authenticated', 'client.fl@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Eleanor","last_name":"Vance"}'::jsonb, NOW(), NOW(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '3ae89f6b-d18f-4378-91ec-2187a55c9522', 'authenticated', 'authenticated', 'client.in@caregiver.com', crypt(seed_pwd, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Thomas","last_name":"Sterling"}'::jsonb, NOW(), NOW(), '', '', '', '')
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(seed_pwd, gen_salt('bf')),
    email_confirmed_at = NOW(),
    updated_at = NOW();
END $$;

-- Auth identities (for GoTrue password authentication)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  ('3f9d1f38-b03e-466f-98bf-dab66163d63c', '3f9d1f38-b03e-466f-98bf-dab66163d63c', '{"sub":"3f9d1f38-b03e-466f-98bf-dab66163d63c","email":"admin@caregiver.com"}'::jsonb, 'email', 'admin@caregiver.com', NOW(), NOW(), NOW()),
  ('26fecbcc-2b75-4770-86b3-95fd866a9b50', '26fecbcc-2b75-4770-86b3-95fd866a9b50', '{"sub":"26fecbcc-2b75-4770-86b3-95fd866a9b50","email":"caregiver.fl@caregiver.com"}'::jsonb, 'email', 'caregiver.fl@caregiver.com', NOW(), NOW(), NOW()),
  ('da6c3061-7845-4074-9dea-fd996bb91cc4', 'da6c3061-7845-4074-9dea-fd996bb91cc4', '{"sub":"da6c3061-7845-4074-9dea-fd996bb91cc4","email":"caregiver.in@caregiver.com"}'::jsonb, 'email', 'caregiver.in@caregiver.com', NOW(), NOW(), NOW()),
  ('515aad09-c5b7-456a-8d4f-4cd03beaad09', '515aad09-c5b7-456a-8d4f-4cd03beaad09', '{"sub":"515aad09-c5b7-456a-8d4f-4cd03beaad09","email":"caregiver.ga@caregiver.com"}'::jsonb, 'email', 'caregiver.ga@caregiver.com', NOW(), NOW(), NOW()),
  ('90034b85-5667-4261-ac11-f3de38acc1c9', '90034b85-5667-4261-ac11-f3de38acc1c9', '{"sub":"90034b85-5667-4261-ac11-f3de38acc1c9","email":"client.fl@caregiver.com"}'::jsonb, 'email', 'client.fl@caregiver.com', NOW(), NOW(), NOW()),
  ('3ae89f6b-d18f-4378-91ec-2187a55c9522', '3ae89f6b-d18f-4378-91ec-2187a55c9522', '{"sub":"3ae89f6b-d18f-4378-91ec-2187a55c9522","email":"client.in@caregiver.com"}'::jsonb, 'email', 'client.in@caregiver.com', NOW(), NOW(), NOW())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Public users mapping
INSERT INTO users (id, email, role_id, state_id, status) VALUES
  ('3f9d1f38-b03e-466f-98bf-dab66163d63c', 'admin@caregiver.com', 4, 1, 'active'),
  ('26fecbcc-2b75-4770-86b3-95fd866a9b50', 'caregiver.fl@caregiver.com', 2, 1, 'active'),
  ('da6c3061-7845-4074-9dea-fd996bb91cc4', 'caregiver.in@caregiver.com', 2, 2, 'active'),
  ('515aad09-c5b7-456a-8d4f-4cd03beaad09', 'caregiver.ga@caregiver.com', 2, 3, 'active'),
  ('90034b85-5667-4261-ac11-f3de38acc1c9', 'client.fl@caregiver.com', 3, 1, 'active'),
  ('3ae89f6b-d18f-4378-91ec-2187a55c9522', 'client.in@caregiver.com', 3, 2, 'active')
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  state_id = EXCLUDED.state_id,
  status = EXCLUDED.status;

-- Caregivers profile table
INSERT INTO caregivers (id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4) VALUES
  ('26fecbcc-2b75-4770-86b3-95fd866a9b50', 1, 'Sarah', 'Jenkins', '(555) 234-5678', '100 Biscayne Blvd, Miami, FL 33132', '1988-04-12', '4321'),
  ('da6c3061-7845-4074-9dea-fd996bb91cc4', 2, 'Michael', 'Chang', '(555) 345-6789', '200 N Meridian St, Indianapolis, IN 46204', '1992-09-25', '8765'),
  ('515aad09-c5b7-456a-8d4f-4cd03beaad09', 3, 'Jessica', 'Williams', '(555) 456-7890', '300 Peachtree St, Atlanta, GA 30308', '1990-11-03', '2198')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone;

-- Clients profile table
INSERT INTO clients (id, state_id, first_name, last_name, phone, address, date_of_birth, medicaid_number) VALUES
  ('90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'Eleanor', 'Vance', '(555) 567-8901', '450 Ocean Dr, Fort Lauderdale, FL 33301', '1948-02-18', 'FL-MED-849201'),
  ('3ae89f6b-d18f-4378-91ec-2187a55c9522', 2, 'Thomas', 'Sterling', '(555) 678-9012', '520 Broad Ripple Ave, Indianapolis, IN 46220', '1952-07-14', 'IN-MED-391048')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  medicaid_number = EXCLUDED.medicaid_number;


