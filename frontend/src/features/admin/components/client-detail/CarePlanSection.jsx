import {
  PLAN_STATUS_BADGE,
  PLAN_STATUS_LABELS,
  ACTIVITY_OPTIONS,
  FREQUENCY_OPTIONS,
} from '../../constants/clientDetailConstants';

export default function CarePlanSection({
  carePlan,
  cpStatus,
  setCpStatus,
  cpEffectiveDate,
  setCpEffectiveDate,
  cpPrimaryNurse,
  setCpPrimaryNurse,
  cpEmergencyProtocol,
  setCpEmergencyProtocol,
  activities,
  setActivityField,
  addActivityRow,
  removeActivityRow,
  savingPlan,
  handleSavePlan,
}) {
  return (
    <div className="admin-card mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="section-title m-0">Plan of Care</h2>
        {carePlan && (
          <span className={`badge ${PLAN_STATUS_BADGE[carePlan.status] || 'badge-neutral'}`}>
            {PLAN_STATUS_LABELS[carePlan.status] || carePlan.status}
          </span>
        )}
      </div>
      {!carePlan && (
        <p className="text-secondary text-sm mb-4">
          No plan on file yet. Create one below — the client portal will show it immediately.
        </p>
      )}

      <form onSubmit={handleSavePlan} className="flex flex-col gap-4 mt-3">
        <div className="form-grid-2">
          <div>
            <label htmlFor="cp-status">Plan Status</label>
            <select id="cp-status" value={cpStatus} onChange={(e) => setCpStatus(e.target.value)}>
              {Object.entries(PLAN_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cp-effective-date">Effective Date</label>
            <input
              id="cp-effective-date"
              type="date"
              value={cpEffectiveDate}
              onChange={(e) => setCpEffectiveDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cp-primary-nurse">Clinical Supervisor</label>
            <input
              id="cp-primary-nurse"
              type="text"
              maxLength={200}
              value={cpPrimaryNurse}
              onChange={(e) => setCpPrimaryNurse(e.target.value)}
              placeholder="E.g., RN Maria Alvarez"
            />
          </div>
        </div>
        <div>
          <label htmlFor="cp-emergency-protocol">Emergency Protocol</label>
          <textarea
            id="cp-emergency-protocol"
            rows={3}
            value={cpEmergencyProtocol}
            onChange={(e) => setCpEmergencyProtocol(e.target.value)}
            placeholder="Safety instructions and steps for medical emergencies."
          />
        </div>

        <div>
          <div className="label-row">
            <label>Daily Living Activities</label>
            <button
              type="button"
              onClick={addActivityRow}
              className="btn-sm btn-success"
            >
              + Add Activity
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="table-empty-sm">
              No activities added. Click "Add Activity" to build the daily care routine.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {activities.map((act, idx) => (
                <div key={idx} className="card p-3 grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4 max-md:col-span-12 flex flex-col gap-2">
                    <select
                      value={act.custom ? 'custom' : act.task}
                      onChange={(e) => {
                        const v = e.target.value;
                        setActivityField(idx, 'task', v === 'custom' ? '' : v);
                        setActivityField(idx, 'custom', v === 'custom');
                      }}
                      aria-label="Activity"
                    >
                      <option value="">Select activity…</option>
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="custom">Custom…</option>
                    </select>
                    {act.custom && (
                      <input
                        type="text"
                        value={act.task}
                        onChange={(e) => setActivityField(idx, 'task', e.target.value)}
                        placeholder="Custom activity name"
                      />
                    )}
                  </div>
                  <div className="col-span-3 max-md:col-span-12 flex flex-col gap-2">
                    <select
                      value={act.freqCustom ? 'custom' : act.frequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        setActivityField(idx, 'frequency', v === 'custom' ? '' : v);
                        setActivityField(idx, 'freqCustom', v === 'custom');
                      }}
                      aria-label="Frequency"
                    >
                      <option value="">Select frequency…</option>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="custom">Custom…</option>
                    </select>
                    {act.freqCustom && (
                      <input
                        type="text"
                        value={act.frequency}
                        onChange={(e) => setActivityField(idx, 'frequency', e.target.value)}
                        placeholder="Custom frequency"
                      />
                    )}
                  </div>
                  <div className="col-span-4 max-md:col-span-10">
                    <input
                      type="text"
                      value={act.notes}
                      onChange={(e) => setActivityField(idx, 'notes', e.target.value)}
                      placeholder="Caregiver directive"
                    />
                  </div>
                  <div className="col-span-1 max-md:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeActivityRow(idx)}
                      title="Remove activity"
                      className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <button type="submit" disabled={savingPlan} className="btn-primary">
            {savingPlan ? 'Saving...' : carePlan ? 'Save Plan of Care' : 'Create Plan of Care'}
          </button>
        </div>
      </form>
    </div>
  );
}
