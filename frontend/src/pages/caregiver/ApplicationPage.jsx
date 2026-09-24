import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { formatBusinessDaysAgo } from '../../utils/businessDays';
import {
  STATUS_META,
  ROADMAP_STEPS,
  stepBadge,
  milestoneMeta,
} from '../../utils/caregiverStatus';
import { saveDraft, loadDraft, clearDraft, DRAFT_TTL_MS } from '../../utils/draftStorage';
import { caregiverApplicationSchema, applicationDefaultValues, toApplicationPayload } from '../../utils/validation';
import SignaturePad from '../../components/common/SignaturePad';
import { packetUrl, STATE_PACKET_CODE } from '../../utils/packets';

const STATE_SLUG_MAP = {
  florida: '1',
  indiana: '2',
  georgia: '3',
};

const STATE_LABELS = {
  1: 'Florida (FL)',
  2: 'Indiana (IN)',
  3: 'Georgia (GA)',
};

function FieldError({ message }) {
  if (!message) return null;
  return <span className="text-xs text-red-600 mt-1 block">{message}</span>;
}

export default function ApplicationPage() {
  const { token, user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(Boolean(token));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [application, setApplication] = useState(null);
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);
  const [successMode, setSuccessMode] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // Determine initial state from query params or user
  const queryState = searchParams.get('state')?.toLowerCase();
  const initialJob = searchParams.get('job') || '';

  const draftIdentity = user?.id || 'anon';

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

  function stateIdFallback() {
    if (user?.state_id) return user.state_id;
    if (queryState && STATE_SLUG_MAP[queryState]) return Number(STATE_SLUG_MAP[queryState]);
    return 1;
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

  // Hydrate from server when signed in; otherwise restore the browser draft
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

  // Autosave the form to the browser as the applicant types (debounced).
  // Disabled while the application is locked or submitting.
  const watched = watch();

  useEffect(() => {
    const meta = application ? STATUS_META[application.status] : null;
    if (meta?.locked || isSubmitting) return;

    const timer = setTimeout(() => {
      const draft = {
        firstName: watched.first_name,
        lastName: watched.last_name,
        phone: watched.phone,
        address: watched.address,
        dateOfBirth: watched.date_of_birth,
        ssnLast4: watched.ssn_last4,
        stateId: String(watched.state_id),
        notes: watched.notes,
        ...(user ? {} : { email: watched.email }),
      };
      if (saveDraft(draftIdentity, draft)) {
        setDraftSavedAt(new Date());
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, application, isSubmitting, token]);

  function handleClearDraft() {
    clearDraft();
    setDraftSavedAt(null);
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function onValid(values) {
    setErrorMsg('');
    setSuccessMsg('');

    // Defensive guard: submitted/locked applications can't be edited.
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

        // Auto-login candidate into their new portal
        try {
          await login(values.email.trim(), values.password);
        } catch {
          // If auto-login fails, they can still sign in manually
        }
      } catch (err) {
        setErrorMsg(err.detail || 'Failed to submit application. Please verify your details.');
      }
    }
  }

  if (loading) {
    return <div className="loading-screen">Loading application details...</div>;
  }

  const appStatus = application?.status || null;
  const meta = (appStatus && STATUS_META[appStatus]) || STATUS_META.draft;
  const formLocked = !!(application && meta.locked);
  const isRejected = appStatus === 'rejected';
  const submittedAt = application?.submitted_at || application?.created_at || null;
  const daysAgoText = formatBusinessDaysAgo(submittedAt);
  const rejectionReason = isRejected && (application?.rejection_reason || application?.notes) ? (application.rejection_reason || application.notes) : null;
  const milestone = milestoneMeta(appStatus);

  const values = watch();
  const firstName = values.first_name || '';
  const lastName = values.last_name || '';
  const stateId = values.state_id;
  const signatureValue = values.signature_data;

  const stateName = (id) => STATE_LABELS[id] || `State #${id}`;

  // Success Confirmation Screen
  if (isSuccessSubmitted) {
    const isResubmit = successMode === 'resubmit';
    return (
      <div className="container-narrow">
        <div className="card text-center stat-card-success p-6">
          <div className="success-icon-circle">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="page-title mb-2">
            {isResubmit ? 'Application Resubmitted Successfully!' : 'Application Submitted Successfully!'}
          </h1>
          <p className="text-secondary text-sm leading-normal max-w-lg mx-auto mb-6">
            {isResubmit
              ? 'Your updated application details have been received and are now back under review by our state compliance team.'
              : 'Welcome to the CarePlatform clinical team! Your onboarding profile has been created and your application is now under review by our state compliance team.'}
          </p>

          <div className="card-muted mb-6 text-left">
            <h3 className="font-semibold text-sm mb-2">
              Next Steps in Your Onboarding:
            </h3>
            <ul className="bullet-list">
              <li><strong>Upload Credentials:</strong> Provide your CPR certificate, Driver's License, and CNA/HHA license in the portal.</li>
              <li><strong>Administrative Review:</strong> A clinical supervisor will verify your information within 1–2 business days.</li>
              <li><strong>In-Service Training:</strong> Access online orientation and safety modules once approved.</li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/caregiver/dashboard')}
              className="btn-primary btn-lg"
            >
              Go to Caregiver Dashboard →
            </button>
            <button
              type="button"
              onClick={() => navigate('/caregiver/documents')}
              className="btn-outline-secondary btn-lg"
            >
              Upload Credentials →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-medium">
      {/* Top Banner & Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="badge badge-blue">
              Direct Candidate Onboarding
            </span>
            <span className="text-xs text-secondary font-semibold">
              Florida • Indiana • Georgia
            </span>
          </div>

          {!user && (
            <Link to="/caregiver/login" className="text-sm font-semibold text-primary">
              Already registered? Sign In →
            </Link>
          )}

          {user && (
            <a
              href={packetUrl(STATE_PACKET_CODE[stateId])}
              target="_blank"
              rel="noreferrer"
              className="btn-outline-secondary btn-sm"
            >
              Download Employment Packet (PDF)
            </a>
          )}
        </div>

        <h1 className="page-title">
          Caregiver Employment Application
        </h1>
        <p className="page-subtitle">
          Apply to provide state-licensed home care services. Fill out your candidate details below — no preliminary registration required.
        </p>
      </div>

      {/* Error and Success alerts */}
      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      {/* Onboarding Roadmap — always visible */}
      <div className="card mb-6">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
          <h2 className="section-title m-0">
            Onboarding Roadmap
          </h2>
          {appStatus && (
            <span className={`badge ${meta.badge}`}>
              {meta.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-4">
          {ROADMAP_STEPS.map((step, i) => (
            <span key={step.key} className="flex items-center gap-3">
              {i > 0 && <span className="text-xs text-muted">→</span>}
              <Link to={step.to} className={`badge ${stepBadge(appStatus, step)}`}>
                {step.label}
              </Link>
            </span>
          ))}
        </div>

        {!appStatus && (
          <div className="banner-info p-4 rounded-md">
            <h3 className="font-semibold text-sm mb-1">Not Started Yet</h3>
            <p className="text-sm text-secondary leading-normal mb-2">
              Fill out the form below — it auto-saves as you type, so you can leave and come back within 7 days without losing progress.
            </p>
          </div>
        )}

        {appStatus && (
          <div className={`p-4 rounded-md ${meta.panelClass}`}>
            <h3 className="font-semibold text-sm mb-1">
              {milestone.title}
            </h3>
            <p className="text-sm text-secondary leading-normal mb-2">
              {milestone.message}
            </p>

            {rejectionReason && (
              <p className="text-sm text-secondary leading-normal p-3 bg-white border border-red-200 rounded-md mb-2">
                <strong>Reason:</strong> {rejectionReason}
              </p>
            )}

            {submittedAt && (
              <p className="text-xs text-muted mb-2">
                {daysAgoText} · Submitted on {new Date(submittedAt).toLocaleDateString()}
              </p>
            )}

            <Link to={milestone.nextAction.to} className="text-sm font-semibold text-primary">
              {milestone.nextAction.label}
            </Link>
          </div>
        )}
      </div>

      {formLocked ? (
        /* Locked: show a clear read-only summary + the ONE next action */
        <div className="card p-6">
          <h2 className="section-title m-0 mb-1">
            Your Application Summary
          </h2>
          <p className="text-secondary text-sm leading-normal mb-4">
            Your application is under compliance review, so your details can't be edited right now. Here's where things stand:
          </p>

          <dl className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-6">
            <div>
              <dt className="text-xs text-muted mb-1">Name</dt>
              <dd className="text-sm font-semibold">{firstName} {lastName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-1">Phone</dt>
              <dd className="text-sm font-semibold">{values.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-1">State Office</dt>
              <dd className="text-sm font-semibold">{stateName(stateId)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-1">Submitted</dt>
              <dd className="text-sm font-semibold">
                {submittedAt ? new Date(submittedAt).toLocaleDateString() : '—'}
              </dd>
            </div>
            {values.notes && (
              <div className="col-span-2">
                <dt className="text-xs text-muted mb-1">Experience & Notes</dt>
                <dd className="text-sm text-secondary leading-normal">{values.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Link to={milestone.nextAction.to} className="btn-primary">
              {milestone.nextAction.label}
            </Link>
            <Link to="/caregiver/profile" className="btn-outline-secondary">
              Edit Profile →
            </Link>
          </div>
        </div>
      ) : (
        /* Editable form */
        <form onSubmit={handleSubmit(onValid)} className="card flex flex-col gap-6">
          {isRejected && (
            <div className="alert alert-error">
              Your previous application was not approved. Update the details below and resubmit to begin a new review.
            </div>
          )}

          {/* SECTION 1: CANDIDATE & CONTACT DETAILS */}
          <div>
            <div className="section-header-bordered">
              <h2 className="section-title m-0">
                Step 1: Personal & Contact Information
              </h2>
              <p className="text-xs text-muted mt-1">
                Your legal name as it appears on your state-issued identification.
              </p>
            </div>

            <div className="form-grid-2 mb-4">
              <div>
                <label htmlFor="first_name">
                  First Name *
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  {...register('first_name')}
                  placeholder="Jane"
                />
                <FieldError message={errors.first_name?.message} />
              </div>

              <div>
                <label htmlFor="last_name">
                  Last Name *
                </label>
                <input
                  id="last_name"
                  type="text"
                  required
                  {...register('last_name')}
                  placeholder="Doe"
                />
                <FieldError message={errors.last_name?.message} />
              </div>
            </div>

            {/* Email Address */}
            <div className="form-grid-2 mb-4">
              <div>
                <label htmlFor="email">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  disabled={Boolean(user)}
                  {...register('email')}
                  placeholder="jane.doe@example.com"
                />
                {user && (
                  <div className="text-xs text-muted mt-2">
                    Signed in as {user.email}
                  </div>
                )}
                {!user && <FieldError message={errors.email?.message} />}
              </div>

              <div>
                <label htmlFor="phone">
                  Phone Number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  {...register('phone')}
                  placeholder="(555) 000-0000"
                />
                <FieldError message={errors.phone?.message} />
              </div>
            </div>

            <div className="form-grid-2 mb-4">
              <div>
                <label htmlFor="state_id">
                  Licensing State Office *
                </label>
                <select
                  id="state_id"
                  {...register('state_id')}
                >
                  <option value="1">Florida (FL)</option>
                  <option value="2">Indiana (IN)</option>
                  <option value="3">Georgia (GA)</option>
                </select>
                <FieldError message={errors.state_id?.message} />
              </div>

              <div>
                <label htmlFor="address">
                  Residential Address
                </label>
                <input
                  id="address"
                  type="text"
                  {...register('address')}
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>
            </div>

            <div className="form-grid-2 mb-4">
              <div>
                <label htmlFor="dob">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  type="date"
                  {...register('date_of_birth')}
                />
              </div>

              <div>
                <label htmlFor="ssn">
                  SSN (Last 4 digits only)
                </label>
                <input
                  id="ssn"
                  type="password"
                  maxLength={4}
                  {...register('ssn_last4', {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, '');
                    },
                  })}
                  placeholder="••••"
                />
                <FieldError message={errors.ssn_last4?.message} />
                <div className="text-xs text-muted mt-2">
                  Used strictly for state nurse registry and background screening lookup.
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="notes">
                Experience, Certifications & Availability
              </label>
              <textarea
                id="notes"
                rows={3}
                {...register('notes')}
                placeholder="E.g., CNA licensed, CPR/First Aid current, 3 years home health aide experience, available weekdays and alternate weekends."
              />
            </div>
          </div>

          {/* SECTION 2: CREATE PORTAL PASSWORD (Only for unauthenticated candidates) */}
          {!user && (
            <div className="card-muted">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-sm m-0">
                    Step 2: Create Portal Password
                  </h2>
                  <span className="badge badge-blue">
                    Save & Track
                  </span>
                </div>
                <p className="text-xs text-secondary m-0">
                  Set a password to instantly access your Caregiver Portal where you will upload required credentials (CPR, TB clearance, CNA/HHA) and view review updates.
                </p>
              </div>

              <div className="form-grid-2">
                <div>
                  <label htmlFor="password">
                    Portal Password *
                  </label>
                  <input
                    id="password"
                    type="password"
                    minLength={6}
                    {...register('password')}
                    placeholder="At least 6 characters"
                  />
                  <FieldError message={errors.password?.message} />
                </div>

                <div>
                  <label htmlFor="confirm-password">
                    Confirm Password *
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    minLength={6}
                    {...register('confirmPassword')}
                    placeholder="Repeat your password"
                  />
                  <FieldError message={errors.confirmPassword?.message} />
                </div>
              </div>
            </div>
          )}

          {/* Draft status + SUBMIT */}
          <div>
            {/* SECTION 3: ELECTRONIC SIGNATURE */}
            <div className="card-muted mb-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-sm m-0">
                  Step 3: Electronic Signature
                </h2>
                <span className="badge badge-blue">
                  Required
                </span>
              </div>
              <p className="text-xs text-secondary m-0 mb-4">
                By drawing your signature, you certify that the information provided in this application is true, accurate, and complete, and you authorize verification of licensure, registry, and background screening records.
              </p>

              <div className="form-grid-2 mb-4">
                <div>
                  <label htmlFor="signed_name">
                    Type Full Legal Name *
                  </label>
                  <input
                    id="signed_name"
                    type="text"
                    required
                    maxLength={200}
                    {...register('signed_name')}
                    placeholder="Jane M. Doe"
                  />
                  <FieldError message={errors.signed_name?.message} />
                </div>
              </div>

              <Controller
                control={control}
                name="signature_data"
                render={({ field }) => (
                  <SignaturePad
                    value={field.value || null}
                    onChange={field.onChange}
                    disabled={false}
                    height={200}
                  />
                )}
              />
              <FieldError message={errors.signature_data?.message} />
              {signatureValue && (
                <p className="text-xs text-success mt-2 mb-0">
                  ✓ Signature captured
                </p>
              )}
            </div>

            {draftSavedAt && (
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs text-muted">
                  Draft saved {draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — stays in this browser for {Math.round(DRAFT_TTL_MS / (24 * 60 * 60 * 1000))} days.
                </span>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-xs font-semibold text-primary underline"
                >
                  Clear draft
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn-full btn-lg"
            >
              {isSubmitting
                ? isRejected
                  ? 'Resubmitting Application...'
                  : 'Submitting Application & Creating Account...'
                : isRejected
                ? 'Resubmit Application →'
                : user
                ? 'Submit Application'
                : 'Submit Employment Application →'}
            </button>

            {!user && (
              <p className="text-center text-xs text-muted mt-2 mb-0">
                By submitting, you authorize the agency to verify licensure and registry status per state health department rules.
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}