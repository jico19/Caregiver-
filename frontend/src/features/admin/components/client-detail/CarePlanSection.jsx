import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
import StatusBadge from '../../../../shared/components/common/StatusBadge';
import {
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
    <Card className="mb-6 p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="font-semibold text-base text-slate-900 m-0">Plan of Care</h2>
        {carePlan && (
          <StatusBadge
            status={carePlan.status}
            label={PLAN_STATUS_LABELS[carePlan.status] || carePlan.status}
          />
        )}
      </div>
      {!carePlan && (
        <p className="text-slate-500 text-xs mb-4">
          No plan on file yet. Create one below — the client portal will show it immediately.
        </p>
      )}

      <form onSubmit={handleSavePlan} className="space-y-4 mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Plan Status" id="cp-status">
            <select
              id="cp-status"
              className="select select-bordered w-full text-sm"
              value={cpStatus}
              onChange={(e) => setCpStatus(e.target.value)}
            >
              {Object.entries(PLAN_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Effective Date" id="cp-effective-date">
            <input
              id="cp-effective-date"
              type="date"
              className="input input-bordered w-full text-sm"
              value={cpEffectiveDate}
              onChange={(e) => setCpEffectiveDate(e.target.value)}
            />
          </FormField>
          <FormField label="Clinical Supervisor" id="cp-primary-nurse">
            <input
              id="cp-primary-nurse"
              type="text"
              maxLength={200}
              className="input input-bordered w-full text-sm"
              value={cpPrimaryNurse}
              onChange={(e) => setCpPrimaryNurse(e.target.value)}
              placeholder="E.g., RN Maria Alvarez"
            />
          </FormField>
        </div>

        <FormField label="Emergency Protocol" id="cp-emergency-protocol">
          <textarea
            id="cp-emergency-protocol"
            rows={3}
            className="textarea textarea-bordered w-full text-sm"
            value={cpEmergencyProtocol}
            onChange={(e) => setCpEmergencyProtocol(e.target.value)}
            placeholder="Safety instructions and steps for medical emergencies."
          />
        </FormField>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-slate-700">Daily Living Activities</label>
            <button
              type="button"
              onClick={addActivityRow}
              className="btn btn-outline btn-xs text-emerald-700 hover:text-emerald-800"
            >
              + Add Activity
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-base-300 rounded">
              No activities added. Click "Add Activity" to build the daily care routine.
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((act, idx) => (
                <div key={idx} className="p-3 rounded border border-base-300 bg-base-200/40 grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                    <select
                      className="select select-bordered select-xs w-full text-xs"
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
                        className="input input-bordered input-xs w-full text-xs"
                        value={act.task}
                        onChange={(e) => setActivityField(idx, 'task', e.target.value)}
                        placeholder="Custom activity name"
                      />
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                    <select
                      className="select select-bordered select-xs w-full text-xs"
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
                        className="input input-bordered input-xs w-full text-xs"
                        value={act.frequency}
                        onChange={(e) => setActivityField(idx, 'frequency', e.target.value)}
                        placeholder="Custom frequency"
                      />
                    )}
                  </div>
                  <div className="col-span-10 md:col-span-4">
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full text-xs"
                      value={act.notes}
                      onChange={(e) => setActivityField(idx, 'notes', e.target.value)}
                      placeholder="Caregiver directive"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeActivityRow(idx)}
                      title="Remove activity"
                      className="btn btn-ghost btn-xs text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <button type="submit" disabled={savingPlan} className="btn btn-primary btn-sm">
            {savingPlan ? 'Saving...' : carePlan ? 'Save Plan of Care' : 'Create Plan of Care'}
          </button>
        </div>
      </form>
    </Card>
  );
}
