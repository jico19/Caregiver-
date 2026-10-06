import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../shared/services/api';
import { STATUS_META } from '../../../shared/utils/caregiverStatus';
import { saveDraft, loadDraft, clearDraft } from '../../../shared/utils/draftStorage';
import {
  caregiverApplicationSchema,
  applicationDefaultValues,
  toApplicationPayload,
} from '../../../shared/utils/validation';
import { STATE_SLUG_MAP } from '../constants/applicationConstants';

export function useCaregiverApplication({ token, user, login }) {
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(Boolean(token));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [application, setApplication] = useState(null);
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);
  const [successMode, setSuccessMode] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const queryState = searchParams.get('state')?.toLowerCase();
  const initialJob = searchParams.get('job') || '';
  const draftIdentity = user?.id || 'anon';

  function stateIdFallback() {
    if (user?.state_id) return user.state_id;
    if (queryState && STATE_SLUG_MAP[queryState]) return Number(STATE_SLUG_MAP[queryState]);
    return 1;
  }

  const {
    register,
    control,
    reset,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(caregiverApplicationSchema),
    defaultValues: {
      ...applicationDefaultValues,
      state_id: user?.state_id ?? (queryState && STATE_SLUG_MAP[queryState] ? Number(STATE_SLUG_MAP[queryState]) : 1),
      notes: initialJob ? `Applying for: ${initialJob}` : '',
      email: user?.email || '',
    },
  });

  function buildServerValues(profile, app) {
    return {
      ...applicationDefaultValues,
      state_id: profile?.state_id ?? stateIdFallback(),
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      date_of_birth: profile?.date_of_birth || '',
      ssn_last4: profile?.ssn_last4 || '',
      notes: app?.notes || '',
      email: user?.email || '',
    };
  }

  function buildDraftValues(draft) {
    if (!draft) return applicationDefaultValues;
    return {
      ...applicationDefaultValues,
      first_name: draft.firstName ?? '',
      last_name: draft.lastName ?? '',
      phone: draft.phone ?? '',
      address: draft.address ?? '',
      date_of_birth: draft.dateOfBirth ?? '',
      ssn_last4: draft.ssnLast4 ?? '',
      state_id: draft.stateId ? Number(draft.stateId) : stateIdFallback(),
      notes: draft.notes ?? '',
      email: user?.email || draft.email || '',
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      if (!token) {
        if (!isMounted) return;
        reset(buildDraftValues(loadDraft('anon')));
        setLoading(false);
        return;
      }

      try {
        const [appRes, profRes] = await Promise.all([
          api.get('/caregivers/me/application', token),
          api.get('/caregivers/me', token),
        ]);
        if (!isMounted) return;

        if (appRes?.application) setApplication(appRes.application);

        const hasServerData = Boolean(appRes?.application) || Boolean(profRes?.profile);
        if (hasServerData) {
          reset(buildServerValues(profRes?.profile, appRes?.application));
        } else {
          reset(buildDraftValues(loadDraft(draftIdentity)));
        }
      } catch {
        if (!isMounted) return;
        setErrorMsg('Failed to load existing application profile.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    hydrate();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const firstNameWatched = useWatch({ control, name: 'first_name' });
  const lastNameWatched = useWatch({ control, name: 'last_name' });
  const phoneWatched = useWatch({ control, name: 'phone' });
  const addressWatched = useWatch({ control, name: 'address' });
  const dobWatched = useWatch({ control, name: 'date_of_birth' });
  const ssnWatched = useWatch({ control, name: 'ssn_last4' });
  const stateWatched = useWatch({ control, name: 'state_id' });
  const notesWatched = useWatch({ control, name: 'notes' });
  const emailWatched = useWatch({ control, name: 'email' });

  const lastDraftRef = useRef('');

  useEffect(() => {
    const meta = application ? STATUS_META[application.status] : null;
    if (meta?.locked || isSubmitting) return;

    const timer = setTimeout(() => {
      const draft = {
        firstName: firstNameWatched,
        lastName: lastNameWatched,
        phone: phoneWatched,
        address: addressWatched,
        dateOfBirth: dobWatched,
        ssnLast4: ssnWatched,
        stateId: String(stateWatched ?? ''),
        notes: notesWatched,
        ...(user ? {} : { email: emailWatched }),
      };
      const serialized = JSON.stringify(draft);
      if (serialized === lastDraftRef.current) return;
      if (saveDraft(draftIdentity, draft)) {
        lastDraftRef.current = serialized;
        setDraftSavedAt(new Date());
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    firstNameWatched, lastNameWatched, phoneWatched, addressWatched,
    dobWatched, ssnWatched, stateWatched, notesWatched, emailWatched,
    application, isSubmitting, token,
  ]);

  function handleClearDraft() {
    clearDraft();
    setDraftSavedAt(null);
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function onValid(values) {
    setErrorMsg('');
    setSuccessMsg('');

    if (application && STATUS_META[application.status]?.locked) {
      setErrorMsg('Your application is currently under review and cannot be edited.');
      return;
    }

    const payload = toApplicationPayload(values, { includeAuth: !token });

    if (token) {
      try {
        if (application?.status === 'rejected') {
          const res = await api.post('/caregivers/applications/resubmit', payload, token);
          setApplication(res.application);
          setSuccessMode('resubmit');
          setSuccessMsg('Your application has been resubmitted and is back under review.');
        } else {
          const res = await api.post('/caregivers/applications', payload, token);
          setApplication(res.application);
          setSuccessMode('new');
          setSuccessMsg('Your application has been successfully updated.');
        }
        clearDraft();
        setDraftSavedAt(null);
        setIsSuccessSubmitted(true);
      } catch (err) {
        setErrorMsg(err.detail || 'Failed to submit application. Please check all fields.');
      }
    } else {
      const publicPayload = {
        email: values.email.trim(),
        password: values.password,
        state_id: values.state_id,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: payload.phone,
        address: payload.address,
        date_of_birth: payload.date_of_birth,
        ssn_last4: payload.ssn_last4,
        notes: payload.notes,
        signature_data: payload.signature_data,
        signed_name: payload.signed_name,
      };

      try {
        const res = await api.post('/caregivers/apply-public', publicPayload);
        setApplication(res.application);
        setSuccessMode('new');
        setSuccessMsg('Your application and portal account have been created successfully!');
        clearDraft();
        setDraftSavedAt(null);
        setIsSuccessSubmitted(true);

        try {
          await login(values.email.trim(), values.password);
        } catch {
          // Allow manual login if auto-login fails
        }
      } catch (err) {
        setErrorMsg(err.detail || 'Failed to submit application. Please verify your details.');
      }
    }
  }

  return {
    loading,
    errorMsg,
    setErrorMsg,
    successMsg,
    application,
    isSuccessSubmitted,
    successMode,
    draftSavedAt,
    handleClearDraft,
    register,
    control,
    watch,
    errors,
    isSubmitting,
    submitHandler: handleSubmit(onValid),
  };
}
