-- Migration: 20261006160000_atomic_caregiver_application.sql
-- Description: Create atomic stored procedure for caregiver registration and application submission

CREATE OR REPLACE FUNCTION public.create_caregiver_application_atomic(
    p_user_id uuid,
    p_state_id int,
    p_email text,
    p_profile jsonb,
    p_application jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id int;
    v_created_app jsonb;
BEGIN
    -- 1. Resolve caregiver role id
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'caregiver' LIMIT 1;
    IF v_role_id IS NULL THEN
        v_role_id := 2;
    END IF;

    -- 2. Insert or update user record
    INSERT INTO public.users (id, email, role_id, state_id, status)
    VALUES (p_user_id, p_email, v_role_id, p_state_id, 'active')
    ON CONFLICT (id) DO UPDATE SET
        state_id = EXCLUDED.state_id,
        status = EXCLUDED.status;

    -- 3. Upsert caregiver profile
    INSERT INTO public.caregivers (
        id, state_id, first_name, last_name, phone, address, date_of_birth, ssn_last4
    ) VALUES (
        p_user_id,
        p_state_id,
        p_profile->>'first_name',
        p_profile->>'last_name',
        p_profile->>'phone',
        p_profile->>'address',
        (p_profile->>'date_of_birth')::date,
        p_profile->>'ssn_last4'
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        date_of_birth = EXCLUDED.date_of_birth,
        ssn_last4 = EXCLUDED.ssn_last4;

    -- 4. Insert caregiver application
    INSERT INTO public.caregiver_applications (
        caregiver_id, state_id, status, submitted_at, notes, version, content_hash,
        signature_data, signed_name, signed_at
    ) VALUES (
        p_user_id,
        p_state_id,
        'submitted',
        now(),
        p_application->>'notes',
        COALESCE((p_application->>'version')::int, 1),
        p_application->>'content_hash',
        p_application->>'signature_data',
        p_application->>'signed_name',
        (p_application->>'signed_at')::timestamptz
    )
    RETURNING to_jsonb(caregiver_applications.*) INTO v_created_app;

    RETURN v_created_app;
END;
$$;
