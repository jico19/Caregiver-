import FieldError from './FieldError';

export default function ApplicationPersonalInfoStep({
  user,
  register,
  errors,
}) {
  return (
    <div id="step-1">
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
            autoComplete="given-name"
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
            autoComplete="family-name"
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
            inputMode="email"
            autoComplete="email"
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
            inputMode="tel"
            autoComplete="tel"
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
            autoComplete="street-address"
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
            inputMode="numeric"
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
            inputMode="numeric"
            autoComplete="off"
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
  );
}
