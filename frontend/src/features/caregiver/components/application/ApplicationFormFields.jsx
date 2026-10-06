import { Controller } from 'react-hook-form';
import SignaturePad from '../../../../shared/components/common/SignaturePad';
import FieldError from './FieldError';
import ApplicationPersonalInfoStep from './ApplicationPersonalInfoStep';
import { DRAFT_TTL_MS } from '../../../../shared/utils/draftStorage';

export default function ApplicationFormFields({
  user,
  register,
  control,
  errors,
  isSubmitting,
  isRejected,
  signatureValue,
  draftSavedAt,
  onClearDraft,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-6">
      {/* Mobile step navigation quick links */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 border-b border-line md:hidden text-xs">
        <a href="#step-1" className="px-3 py-1.5 rounded bg-subtle text-primary font-medium whitespace-nowrap min-h-[36px] flex items-center">
          1. Personal Info
        </a>
        {!user && (
          <a href="#step-2" className="px-3 py-1.5 rounded bg-subtle text-primary font-medium whitespace-nowrap min-h-[36px] flex items-center">
            2. Password
          </a>
        )}
        <a href="#step-3" className="px-3 py-1.5 rounded bg-subtle text-primary font-medium whitespace-nowrap min-h-[36px] flex items-center">
          3. Signature
        </a>
      </div>

      {isRejected && (
        <div className="alert alert-error">
          Your previous application was not approved. Update the details below and resubmit to begin a new review.
        </div>
      )}

      {/* SECTION 1: CANDIDATE & CONTACT DETAILS */}
      <ApplicationPersonalInfoStep
        user={user}
        register={register}
        errors={errors}
      />

      {/* SECTION 2: CREATE PORTAL PASSWORD (Only for unauthenticated candidates) */}
      {!user && (
        <div id="step-2" className="card-muted">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-sm m-0">
                Step 2: Create Portal Password
              </h2>
              <span className="badge badge-info">
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
        <div id="step-3" className="card-muted mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold text-sm m-0">
              Step 3: Electronic Signature
            </h2>
            <span className="badge badge-info">
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
              onClick={onClearDraft}
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
  );
}
