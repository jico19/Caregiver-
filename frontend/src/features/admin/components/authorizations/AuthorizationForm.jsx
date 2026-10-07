import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
import {
  STATE_CODE_MAP,
  COMMON_NOTE_PRESETS,
  HCPCS_PROCEDURES,
  UNIT_TYPES,
} from '../../constants/authorizationConstants';

export default function AuthorizationForm({
  clients,
  clientId,
  selectedClient,
  onClientChange,
  authNumber,
  setAuthNumber,
  onRegenerateAuthNumber,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onApplyDurationPreset,
  notes,
  setNotes,
  submitting,
  onSubmit,
  onClose,
  editingAuth,
  hcpcsCode,
  setHcpcsCode,
  serviceDescription,
  setServiceDescription,
  totalUnits,
  setTotalUnits,
  unitsUsed,
  setUnitsUsed,
  maxWeeklyHours,
  setMaxWeeklyHours,
  unitType,
  setUnitType,
}) {
  const unitsNum = parseInt(totalUnits, 10) || 0;
  const usedNum = parseInt(unitsUsed, 10) || 0;
  const remNum = unitsNum - usedNum;
  const totalHoursCalculated = unitType === '15_min' ? (unitsNum * 0.25).toFixed(1) : unitsNum;
  const remainingHoursCalculated = unitType === '15_min' ? (remNum * 0.25).toFixed(1) : remNum;

  function handleProcedureChange(code) {
    setHcpcsCode(code);
    const matched = HCPCS_PROCEDURES.find((p) => p.code === code);
    if (matched) {
      setServiceDescription(matched.name);
      if (matched.defaultUnitType) setUnitType(matched.defaultUnitType);
    }
  }

  return (
    <Card className="mb-6 p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-base-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900 m-0">
            {editingAuth ? `Edit Authorization #${authNumber}` : 'Issue Medicaid Service Authorization'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure HCPCS billing code, unit allowance (1 unit = 15m), and weekly caps per state Medicaid plan.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-600"
          title="Close"
        >
          ✕
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select Client */}
          <FormField
            label="Client"
            required
            htmlFor="auth-client"
            helpText={selectedClient?.medicaid_number ? `Medicaid ID: ${selectedClient.medicaid_number}` : undefined}
          >
            <select
              id="auth-client"
              required
              disabled={Boolean(editingAuth)}
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              {clients.map((c) => {
                const stCode = c.states?.code || STATE_CODE_MAP[c.state_id] || 'FL';
                return (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({stCode}) {c.medicaid_number ? `— Medicaid: ${c.medicaid_number}` : ''}
                  </option>
                );
              })}
            </select>
          </FormField>

          {/* Authorization # */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-num" className="text-xs font-medium text-slate-700">
                Authorization # <span className="text-error">*</span>
              </label>
              {!editingAuth && (
                <span className="badge badge-xs badge-success badge-soft">
                  Auto-generated
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="auth-num"
                type="text"
                required
                value={authNumber}
                onChange={(e) => setAuthNumber(e.target.value)}
                placeholder="E.g., AUTH-FL-2026-1049"
                className="input input-bordered input-sm flex-1 font-mono text-sm"
              />
              {!editingAuth && (
                <button
                  type="button"
                  onClick={onRegenerateAuthNumber}
                  title="Generate new authorization code"
                  className="btn btn-sm btn-ghost border border-base-300 text-xs gap-1 font-normal"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Re-roll
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Official state prior authorization (PA) approval tracking number.
            </p>
          </div>

          {/* Procedure Code (HCPCS) */}
          <FormField label="HCPCS Procedure Code" required htmlFor="auth-hcpcs">
            <div className="flex gap-2">
              <select
                id="auth-hcpcs"
                value={hcpcsCode}
                onChange={(e) => handleProcedureChange(e.target.value)}
                className="select select-bordered select-sm w-44 font-mono font-medium"
              >
                {HCPCS_PROCEDURES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <input
                id="auth-service-desc"
                type="text"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Service description"
                className="input input-bordered input-sm flex-1 text-xs"
              />
            </div>
          </FormField>

          {/* Unit Type */}
          <FormField label="Billing Unit Increment" required htmlFor="auth-unit-type">
            <select
              id="auth-unit-type"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              {UNIT_TYPES.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Total Units Authorized */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-total-units" className="text-xs font-medium text-slate-700">
                Total Authorized Units <span className="text-error">*</span>
              </label>
              <span className="text-xs font-semibold text-primary">
                ≈ {totalHoursCalculated} {unitType === '15_min' ? 'Hours' : 'Units'} Total
              </span>
            </div>
            <input
              id="auth-total-units"
              type="number"
              min="0"
              required
              value={totalUnits}
              onChange={(e) => setTotalUnits(e.target.value)}
              placeholder="e.g. 120"
              className="input input-bordered input-sm w-full"
            />
            <p className="text-xs text-slate-400 mt-1">
              At 15 min/unit, 4 units = 1 hr (e.g. 120 units = 30 hrs total allowance).
            </p>
          </div>

          {/* Units Used & Balance Info */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-units-used" className="text-xs font-medium text-slate-700">
                Units Burned / Used
              </label>
              <span className={`text-xs font-semibold ${remNum >= 0 ? 'text-success' : 'text-error'}`}>
                {remNum >= 0
                  ? `${remNum} Units (${remainingHoursCalculated} hrs) Remaining`
                  : `${Math.abs(remNum)} Units (${Math.abs(remainingHoursCalculated)} hrs) Over allowance`}
              </span>
            </div>
            <input
              id="auth-units-used"
              type="number"
              min="0"
              value={unitsUsed}
              onChange={(e) => setUnitsUsed(e.target.value)}
              placeholder="0"
              className="input input-bordered input-sm w-full"
            />
            <p className="text-xs text-slate-400 mt-1">
              Logged units deducted as visits occur against this authorization.
            </p>
          </div>

          {/* Max Weekly Hours Cap */}
          <FormField
            label="Weekly Hour Cap (hrs/week)"
            htmlFor="auth-max-weekly-hours"
            helpText="Maximum reimbursable service hours per 7-day schedule period."
          >
            <input
              id="auth-max-weekly-hours"
              type="number"
              step="0.5"
              min="0"
              max="168"
              value={maxWeeklyHours}
              onChange={(e) => setMaxWeeklyHours(e.target.value)}
              placeholder="e.g. 30.0"
              className="input input-bordered input-sm w-full"
            />
          </FormField>

          {/* Start Date */}
          <FormField label="Start Date" required htmlFor="auth-start">
            <input
              id="auth-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </FormField>

          {/* End Date + Presets */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-end" className="text-xs font-medium text-slate-700">
                End Date <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(90)}
                  className="btn btn-ghost btn-xs border border-base-300 font-normal px-1.5 h-6 min-h-0 text-[11px]"
                >
                  +90d
                </button>
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(180)}
                  className="btn btn-ghost btn-xs border border-base-300 font-normal px-1.5 h-6 min-h-0 text-[11px]"
                >
                  +6mo
                </button>
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(365)}
                  className="btn btn-ghost btn-xs border border-base-300 font-normal px-1.5 h-6 min-h-0 text-[11px]"
                >
                  +1yr
                </button>
              </div>
            </div>
            <input
              id="auth-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>

          {/* Covered Services / Notes */}
          <div className="col-span-full">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label htmlFor="auth-notes" className="text-xs font-medium text-slate-700">
                Covered Services & Clinical Notes
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {COMMON_NOTE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNotes(preset)}
                    className="btn btn-ghost btn-xs border border-base-300 font-normal px-2 h-6 min-h-0 text-[11px] text-slate-600"
                  >
                    + {preset.split('—')[0].trim()}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="auth-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., 20 hours/week Personal Care Assistance, Level 2 assistance"
              className="input input-bordered input-sm w-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-base-200">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-sm"
          >
            {submitting ? (editingAuth ? 'Saving Changes...' : 'Issuing Authorization...') : (editingAuth ? 'Save Changes' : 'Issue Authorization')}
          </button>
        </div>
      </form>
    </Card>
  );
}
