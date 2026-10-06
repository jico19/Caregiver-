import { Controller } from 'react-hook-form';
import SignaturePad from '../../../../shared/components/common/SignaturePad';
import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Mobile step navigation quick links */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-base-300 md:hidden text-xs">
        <a href="#step-1" className="px-3 py-1.5 rounded bg-base-200 text-emerald-800 font-medium whitespace-nowrap min-h-[36px] flex items-center">
          1. Personal Info
        </a>
        {!user && (
          <a href="#step-2" className="px-3 py-1.5 rounded bg-base-200 text-emerald-800 font-medium whitespace-nowrap min-h-[36px] flex items-center">
            2. Password
          </a>
        )}
        <a href="#step-3" className="px-3 py-1.5 rounded bg-base-200 text-emerald-800 font-medium whitespace-nowrap min-h-[36px] flex items-center">
          3. Signature
        </a>
      </div>

      {isRejected && (
        <div role="alert" className="alert alert-error">
          <span>Your previous application was not approved. Update the details below and resubmit to begin a new review.</span>
        </div>
      )}

      {/* SECTION 1: CANDIDATE & CONTACT DETAILS */}
      <Card>
        <ApplicationPersonalInfoStep
          user={user}
          register={register}
          errors={errors}
        />
      </Card>

      {/* SECTION 2: CREATE PORTAL PASSWORD (Only for unauthenticated candidates) */}
      {!user && (
        <Card id="step-2">
          <div className="border-b border-base-300 pb-2 mb-4">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-semibold text-base text-slate-900 m-0">
                Step 2: Create Portal Password
              </h2>
              <span className="badge badge-soft text-slate-700 text-xs">
                Save & Track
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0">
              Set a password to instantly access your Caregiver Portal where you will upload required credentials (CPR, TB clearance, CNA/HHA) and view review updates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Portal Password"
              id="password"
              required
              hint="At least 6 characters"
              error={errors.password?.message}
            >
              <input
                id="password"
                type="password"
                minLength={6}
                className="input input-bordered w-full text-sm"
                {...register('password')}
                placeholder="••••••••"
              />
            </FormField>

            <FormField
              label="Confirm Password"
              id="confirm-password"
              required
              hint="Repeat your password"
              error={errors.confirmPassword?.message}
            >
              <input
                id="confirm-password"
                type="password"
                minLength={6}
                className="input input-bordered w-full text-sm"
                {...register('confirmPassword')}
                placeholder="••••••••"
              />
            </FormField>
          </div>
        </Card>
      )}

      {/* SECTION 3: ELECTRONIC SIGNATURE */}
      <Card id="step-3">
        <div className="border-b border-base-300 pb-2 mb-4">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="font-semibold text-base text-slate-900 m-0">
              Step 3: Electronic Signature
            </h2>
            <span className="badge badge-soft text-slate-700 text-xs">
              Required
            </span>
          </div>
          <p className="text-xs text-slate-500 m-0">
            By drawing your signature, you certify that the information provided in this application is true, accurate, and complete, and you authorize verification of licensure, registry, and background screening records.
          </p>
        </div>

        <div className="mb-4">
          <FormField
            label="Type Full Legal Name"
            id="signed_name"
            required
            error={errors.signed_name?.message}
          >
            <input
              id="signed_name"
              type="text"
              required
              maxLength={200}
              className="input input-bordered w-full text-sm sm:max-w-md"
              {...register('signed_name')}
              placeholder="Jane M. Doe"
            />
          </FormField>
        </div>

        <div>
          <label className="label py-1">
            <span className="label-text text-xs font-semibold text-slate-700">
              Draw Signature <span className="text-red-600 ml-0.5">*</span>
            </span>
          </label>
          <div className="border border-base-300 rounded overflow-hidden">
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
          </div>
          {errors.signature_data?.message && (
            <p className="text-xs text-red-600 mt-1">{errors.signature_data.message}</p>
          )}
          {signatureValue && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              ✓ Signature captured
            </p>
          )}
        </div>
      </Card>

      {/* Submit Section */}
      <div className="space-y-3">
        {draftSavedAt && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">
              Draft saved {draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — stays in this browser for {Math.round(DRAFT_TTL_MS / (24 * 60 * 60 * 1000))} days.
            </span>
            <button
              type="button"
              onClick={onClearDraft}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              Clear draft
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting
            ? isRejected
              ? 'Resubmitting Application...'
              : 'Submitting Application & Creating Account...'
            : isRejected
            ? 'Resubmit Application'
            : user
            ? 'Submit Application'
            : 'Submit Employment Application'}
        </button>

        {!user && (
          <p className="text-center text-xs text-slate-500 m-0">
            By submitting, you authorize the agency to verify licensure and registry status per state health department rules.
          </p>
        )}
      </div>
    </form>
  );
}
