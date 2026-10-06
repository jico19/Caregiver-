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
    <div className="auth-issue-card">
      <div className="card-head-bordered">
        <div>
          <h2 className="heading-card m-0">
            Issue Medicaid Service Authorization
          </h2>
          <p className="form-hint">
            Authorization numbers are auto-formatted per state Medicaid guidelines.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-icon-muted"
          title="Close"
        >
          ✕
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-grid-2">
          {/* Select Client */}
          <div>
            <label htmlFor="auth-client" className="form-label-strong">
              Client *
            </label>
            <select
              id="auth-client"
              required
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
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
            {selectedClient?.medicaid_number && (
              <div className="field-hint">
                Medicaid ID: <strong className="text-ink">{selectedClient.medicaid_number}</strong>
              </div>
            )}
          </div>

          {/* Auto-generated Authorization # */}
          <div>
            <div className="label-row">
              <label htmlFor="auth-num">
                Authorization # *
              </label>
              <span className="chip-success">
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
                className="input-mono"
              />
              <button
                type="button"
                onClick={onRegenerateAuthNumber}
                title="Generate new authorization code"
                className="btn-reroll"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Re-roll
              </button>
            </div>
            <div className="field-hint-sm">
              Automatically generated. You can modify this to match an official state PA notice.
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="auth-start" className="form-label-strong">
              Start Date *
            </label>
            <input
              id="auth-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date + Presets */}
          <div>
            <div className="label-row">
              <label htmlFor="auth-end">
                End Date *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(90)}
                  className="btn-preset"
                >
                  +90d
                </button>
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(180)}
                  className="btn-preset"
                >
                  +6mo
                </button>
                <button
                  type="button"
                  onClick={() => onApplyDurationPreset(365)}
                  className="btn-preset"
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
            />
          </div>

          {/* Covered Services / Notes */}
          <div className="col-span-full">
            <div className="label-row flex-wrap gap-2">
              <label htmlFor="auth-notes">
                Covered Services & Approved Units
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {COMMON_NOTE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNotes(preset)}
                    className="btn-preset-ghost"
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
            />
          </div>
        </div>

        <div className="form-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-success btn-submit-auth"
          >
            {submitting ? 'Issuing Authorization...' : 'Issue Authorization'}
          </button>
        </div>
      </form>
    </div>
  );
}
