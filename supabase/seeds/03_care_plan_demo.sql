-- ============================================================
-- Demo care plans, activities, and schedules
--
-- For the seeded clients Eleanor Vance (FL) and Thomas Sterling (IN).
-- Depends on the users inserted by 01_core.sql, so it must run after it.
-- ============================================================

INSERT INTO care_plans (id, client_id, state_id, status, effective_date, primary_nurse, emergency_protocol, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000001', '90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'active', '2026-01-05', 'RN Sarah Jimenez', 'In event of medical emergency, contact 911 immediately, then notify the agency on-call supervisor at (555) 019-0100.', '3f9d1f38-b03e-466f-98bf-dab66163d63c'),
  ('c1000000-0000-0000-0000-000000000002', '3ae89f6b-d18f-4378-91ec-2187a55c9522', 2, 'active', '2026-01-08', 'RN Michael Okafor', 'Call 911 for any medical emergency, then contact the agency on-call coordinator at (555) 019-0200.', '3f9d1f38-b03e-466f-98bf-dab66163d63c')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  primary_nurse = EXCLUDED.primary_nurse,
  emergency_protocol = EXCLUDED.emergency_protocol;

INSERT INTO care_plan_activities (id, care_plan_id, task, frequency, notes, sort_order) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Personal Hygiene & Grooming', 'Daily (Morning)', 'Assistance with bathing and dressing.', 1),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Meal Preparation & Hydration', 'Daily (Lunch & Dinner)', 'Low-sodium dietary support.', 2),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Medication Reminders', 'Twice daily', 'Verify client self-administers prescribed medicines.', 3),
  ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Mobility & Fall Prevention', 'As needed', 'Support with transfers and light ambulation.', 4),
  ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Light Housekeeping & Sanitization', '3x / week', 'Keep client care area tidy and clean.', 5),
  ('c2000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000002', 'Personal Hygiene & Grooming', 'Daily (Morning)', 'Assistance with bathing and dressing.', 1),
  ('c2000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000002', 'Transfer Assistance', 'Daily (As needed)', 'Support for safe transfers from bed to chair.', 2),
  ('c2000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000002', 'Medication Reminders', 'Twice daily', 'Verify client self-administers prescribed medicines.', 3),
  ('c2000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000002', 'Companionship & Safety Monitoring', 'Daily', 'Check-in calls and ambient supervision.', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO care_schedules (id, client_id, state_id, day_of_week, start_time, end_time, service, status, sort_order) VALUES
  ('c3000000-0000-0000-0000-000000000001', '90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'Monday',    '09:00', '13:00', 'Personal Care Assistance',    'confirmed', 1),
  ('c3000000-0000-0000-0000-000000000002', '90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'Wednesday', '09:00', '13:00', 'Personal Care Assistance',    'confirmed', 2),
  ('c3000000-0000-0000-0000-000000000003', '90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'Friday',    '09:00', '13:00', 'Personal Care & Homemaking',  'scheduled', 3),
  ('c3000000-0000-0000-0000-000000000004', '90034b85-5667-4261-ac11-f3de38acc1c9', 1, 'Saturday',  '10:00', '14:00', 'Respite Care Support',        'scheduled', 4),
  ('c3000000-0000-0000-0000-000000000011', '3ae89f6b-d18f-4378-91ec-2187a55c9522', 2, 'Monday',    '08:00', '12:00', 'Personal Care Assistance',    'confirmed', 1),
  ('c3000000-0000-0000-0000-000000000012', '3ae89f6b-d18f-4378-91ec-2187a55c9522', 2, 'Tuesday',   '14:00', '16:00', 'Medication Reminder Visits',  'scheduled', 2),
  ('c3000000-0000-0000-0000-000000000013', '3ae89f6b-d18f-4378-91ec-2187a55c9522', 2, 'Thursday',  '08:00', '12:00', 'Personal Care & Homemaking',  'scheduled', 3)
ON CONFLICT (id) DO NOTHING;
