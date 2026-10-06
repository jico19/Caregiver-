import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
import { STATE_CODE_MAP, COMMON_NOTE_PRESETS } from '../../constants/authorizationConstants';

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
}) {
  return (
    <Card className="mb-6 p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-base-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900 m-0">
            Issue Medicaid Service Authorization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorization numbers are auto-formatted per state Medicaid guidelines.
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

          {/* Auto-generated Authorization # */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-num" className="text-xs font-medium text-slate-700">
                Authorization # <span className="text-error">*</span>
              </label>
              <span className="badge badge-xs badge-success badge-soft">
                Auto-generated
              </span>
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
              <button
                type="button"
                onClick={onRegenerateAuthNumber}
                title="Generate new authorization code"
                className="btn btn-sm btn-ghost border border-base-300 text-xs gap-1 font-normal"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Re-roll
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automatically generated. You can modify this to match an official state PA notice.
            </p>
          </div>

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
          <div>
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
                Covered Services & Approved Units
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
            {submitting ? 'Issuing Authorization...' : 'Issue Authorization'}
          </button>
        </div>
      </form>
    </Card>
  );
}
