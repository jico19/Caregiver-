import FormField from '../../../../shared/components/common/FormField';

export default function ApplicationPersonalInfoStep({
  user,
  register,
  errors,
}) {
  return (
    <div id="step-1" className="space-y-4">
      <div className="border-b border-base-300 pb-2">
        <h2 className="font-semibold text-base text-slate-900 m-0">
          Step 1: Personal & Contact Information
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Your legal name as it appears on your state-issued identification.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="First Name"
          id="first_name"
          required
          error={errors.first_name?.message}
        >
          <input
            id="first_name"
            type="text"
            required
            autoComplete="given-name"
            className="input input-bordered w-full text-sm"
            {...register('first_name')}
            placeholder="Jane"
          />
        </FormField>

        <FormField
          label="Last Name"
          id="last_name"
          required
          error={errors.last_name?.message}
        >
          <input
            id="last_name"
            type="text"
            required
            autoComplete="family-name"
            className="input input-bordered w-full text-sm"
            {...register('last_name')}
            placeholder="Doe"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Email Address"
          id="email"
          required
          hint={user ? `Signed in as ${user.email}` : undefined}
          error={!user ? errors.email?.message : undefined}
        >
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            disabled={Boolean(user)}
            className="input input-bordered w-full text-sm disabled:bg-base-200"
            {...register('email')}
            placeholder="jane.doe@example.com"
          />
        </FormField>

        <FormField
          label="Phone Number"
          id="phone"
          required
          error={errors.phone?.message}
        >
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            className="input input-bordered w-full text-sm"
            {...register('phone')}
            placeholder="(555) 000-0000"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Licensing State Office"
          id="state_id"
          required
          error={errors.state_id?.message}
        >
          <select
            id="state_id"
            className="select select-bordered w-full text-sm"
            {...register('state_id')}
          >
            <option value="1">Florida (FL)</option>
            <option value="2">Indiana (IN)</option>
            <option value="3">Georgia (GA)</option>
          </select>
        </FormField>

        <FormField
          label="Residential Address"
          id="address"
        >
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            className="input input-bordered w-full text-sm"
            {...register('address')}
            placeholder="123 Main St, City, State, ZIP"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Date of Birth"
          id="dob"
        >
          <input
            id="dob"
            type="date"
            inputMode="numeric"
            className="input input-bordered w-full text-sm"
            {...register('date_of_birth')}
          />
        </FormField>

        <FormField
          label="SSN (Last 4 digits only)"
          id="ssn"
          hint="Used strictly for state nurse registry and background screening lookup."
          error={errors.ssn_last4?.message}
        >
          <input
            id="ssn"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className="input input-bordered w-full text-sm"
            {...register('ssn_last4', {
              onChange: (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
              },
            })}
            placeholder="••••"
          />
        </FormField>
      </div>

      <FormField
        label="Experience, Certifications & Availability"
        id="notes"
      >
        <textarea
          id="notes"
          rows={3}
          className="textarea textarea-bordered w-full text-sm"
          {...register('notes')}
          placeholder="E.g., CNA licensed, CPR/First Aid current, 3 years home health aide experience, available weekdays and alternate weekends."
        />
      </FormField>
    </div>
  );
}
