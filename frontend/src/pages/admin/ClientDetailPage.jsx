import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const PLAN_STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'Inactive',
};

const PLAN_STATUS_BADGE = {
  active: 'badge badge-green',
  pending: 'badge badge-yellow',
  inactive: 'badge badge-gray',
};

const SCHEDULE_STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const SCHEDULE_STATUS_BADGE = {
  scheduled: 'badge badge-blue',
  confirmed: 'badge badge-green',
  completed: 'badge badge-gray',
  cancelled: 'badge badge-red',
};

const SERVICE_OPTIONS = [
  'Personal Care Assistance (PCA)',
  'Home Health Aide (HHA)',
  'Companion & Homemaker Services',
  'Respite Care Services',
];

const ACTIVITY_OPTIONS = [
  'Bathing & Grooming Support',
  'Dressing Assistance',
  'Mobility & Transfer Support',
  'Toileting / Incontinence Care',
  'Feeding & Meal Preparation',
  'Medication Reminders',
  'Companionship & Conversation',
  'Light Housekeeping',
  'Errands & Appointments',
  'Respite Care',
];

const FREQUENCY_OPTIONS = [
  '2x daily',
  '3x daily',
  'As needed (PRN)',
  'Morning only',
  'Evening only',
  'Twice weekly',
  'Weekly',
];

const EMPTY_ACTIVITY = {
  task: '',
  frequency: '',
  notes: '',
  custom: false,
  freqCustom: false,
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();

  const [client, setClient] = useState(null);
  const [carePlan, setCarePlan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Care plan editor state
  const [cpStatus, setCpStatus] = useState('active');
  const [cpEffectiveDate, setCpEffectiveDate] = useState('');
  const [cpPrimaryNurse, setCpPrimaryNurse] = useState('');
  const [cpEmergencyProtocol, setCpEmergencyProtocol] = useState('');
  const [activities, setActivities] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);

  // Schedule form state
  const [schedDay, setSchedDay] = useState('Monday');
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('13:00');
  const [schedService, setSchedService] = useState('');
  const [schedCustomService, setSchedCustomService] = useState('');
  const [schedStatus, setSchedStatus] = useState('scheduled');
  const [schedNotes, setSchedNotes] = useState('');
  const [addingSched, setAddingSched] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [res, planRes, schedRes] = await Promise.all([
        api.get(`/admin/clients/${id}`, token),
        api.get(`/admin/clients/${id}/care-plan`, token),
        api.get(`/admin/clients/${id}/schedule`, token),
      ]);
      setClient(res?.client || null);
      setSchedule(schedRes?.schedule || []);
      const plan = planRes?.care_plan || null;
      setCarePlan(plan);
      if (plan) {
        setCpStatus(plan.status || 'active');
        setCpEffectiveDate(plan.effective_date || '');
        setCpPrimaryNurse(plan.primary_nurse || '');
        setCpEmergencyProtocol(plan.emergency_protocol || '');
        setActivities((plan.activities || []).map((a) => ({
          task: a.task || '',
          frequency: a.frequency || '',
          notes: a.notes || '',
          custom: !ACTIVITY_OPTIONS.includes(a.task || ''),
          freqCustom: !FREQUENCY_OPTIONS.includes(a.frequency || ''),
        })));
      } else {
        setActivities([]);
      }
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to load client details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && id) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  function setActivityField(idx, key, val) {
    setActivities((rows) => rows.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));
  }

  function addActivityRow() {
    setActivities((rows) => [...rows, { ...EMPTY_ACTIVITY }]);
  }

  function removeActivityRow(idx) {
    setActivities((rows) => rows.filter((_, i) => i !== idx));
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSavingPlan(true);
    const trimmedActivities = activities
      .map((a, i) => ({
        task: a.task.trim(),
        frequency: a.frequency.trim() || null,
        notes: a.notes.trim() || null,
        sort_order: i,
      }))
      .filter((a) => a.task);

    try {
      await api.put(
        `/admin/clients/${id}/care-plan`,
        {
          status: cpStatus,
          effective_date: cpEffectiveDate || null,
          primary_nurse: cpPrimaryNurse.trim() || null,
          emergency_protocol: cpEmergencyProtocol.trim() || null,
          activities: trimmedActivities,
        },
        token
      );
      setSuccessMsg('Plan of care saved.');
      await loadDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to save plan of care.');
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleAddSchedule(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setAddingSched(true);
    try {
      const service = schedService === 'custom' ? schedCustomService.trim() : schedService;
      await api.post(
        `/admin/clients/${id}/schedule`,
        {
          day_of_week: schedDay,
          start_time: schedStart,
          end_time: schedEnd,
          service: service || null,
          status: schedStatus,
          notes: schedNotes.trim() || null,
        },
        token
      );
      setSuccessMsg('Schedule entry added.');
      setSchedService('');
      setSchedCustomService('');
      setSchedNotes('');
      const res = await api.get(`/admin/clients/${id}/schedule`, token);
      setSchedule(res?.schedule || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to add schedule entry.');
    } finally {
      setAddingSched(false);
    }
  }

  async function handleDeleteSchedule(entry) {
    setErrorMsg('');
    setSuccessMsg('');
    if (!window.confirm(`Delete the ${entry.day_of_week} ${entry.start_time}–${entry.end_time} visit?`)) return;
    try {
      await api.delete(`/admin/clients/${id}/schedule/${entry.id}`, token);
      setSuccessMsg('Schedule entry deleted.');
      const res = await api.get(`/admin/clients/${id}/schedule`, token);
      setSchedule(res?.schedule || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to delete schedule entry.');
    }
  }

  if (loading) {
    return <div className="table-loading-sm">Loading client details...</div>;
  }

  if (!client) {
    return (
      <div className="page-container">
        <div role="alert" className="alert alert-error">Client not found.</div>
        <Link to="/admin/clients" className="text-sm font-semibold text-primary">
          ← Back to Client Directory
        </Link>
      </div>
    );
  }

  const stateName = client.states?.name;
  const stateCode = client.states?.code;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {client.first_name} {client.last_name}
          </h1>
          <p className="page-subtitle">
            <Link to="/admin/clients" className="text-sm font-semibold text-primary">
              ← Back to Client Directory
            </Link>
          </p>
        </div>
        <span className={`badge ${client.users?.status === 'active' ? 'badge-green' : 'badge-yellow'} badge-lg`}>
          {(client.users?.status || 'active').toUpperCase()}
        </span>
      </div>

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

      {/* Client Details */}
      <div className="card mb-6 p-5">
        <h2 className="section-title m-0 mb-4">Client Details</h2>

        <dl className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-4">
          <div>
            <dt className="text-xs text-muted mb-1">Portal Email</dt>
            <dd className="text-sm font-semibold">{client.users?.email || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">State</dt>
            <dd className="text-sm font-semibold">
              {stateName && stateCode ? `${stateName} (${stateCode})` : stateCode || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Medicaid #</dt>
            <dd className="text-sm font-semibold">{client.medicaid_number || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Phone</dt>
            <dd className="text-sm font-semibold">{client.phone || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Registered</dt>
            <dd className="text-sm font-semibold">
              {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>

        {client.address && (
          <div>
            <dt className="text-xs text-muted mb-1">Address</dt>
            <dd className="text-sm text-secondary">{client.address}</dd>
          </div>
        )}

        <div className="mt-4">
          <Link
            to={`/admin/authorizations?client_id=${client.id}&state_id=${client.state_id}`}
            className="text-sm font-semibold text-primary underline"
          >
            Manage authorizations for this client →
          </Link>
        </div>
      </div>

      {/* Plan of Care */}
      <div className="admin-card mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="section-title m-0">
            Plan of Care
          </h2>
          {carePlan && (
            <span className={`badge ${PLAN_STATUS_BADGE[carePlan.status] || 'badge badge-gray'}`}>
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

      {/* Schedule */}
      <div className="admin-card">
        <h2 className="section-title m-0 mb-4">
          Visit Schedule ({schedule.length})
        </h2>

        <form onSubmit={handleAddSchedule} className="card p-4 mb-4 flex flex-col gap-3">
          <div className="form-grid-2">
            <div>
              <label htmlFor="sched-day">Day of Week</label>
              <select id="sched-day" value={schedDay} onChange={(e) => setSchedDay(e.target.value)}>
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sched-status">Status</label>
              <select id="sched-status" value={schedStatus} onChange={(e) => setSchedStatus(e.target.value)}>
                {Object.entries(SCHEDULE_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sched-start">Start Time</label>
              <input
                id="sched-start"
                type="time"
                required
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="sched-end">End Time</label>
              <input
                id="sched-end"
                type="time"
                required
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="sched-service">Service</label>
              <select
                id="sched-service"
                value={schedService}
                onChange={(e) => setSchedService(e.target.value)}
              >
                <option value="">No service</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {schedService === 'custom' && (
                <input
                  type="text"
                  maxLength={200}
                  value={schedCustomService}
                  onChange={(e) => setSchedCustomService(e.target.value)}
                  placeholder="Enter custom service name"
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <label htmlFor="sched-notes">Notes</label>
              <input
                id="sched-notes"
                type="text"
                value={schedNotes}
                onChange={(e) => setSchedNotes(e.target.value)}
                placeholder="Optional care instructions"
              />
            </div>
          </div>
          <div>
            <button type="submit" disabled={addingSched} className="btn-success">
              {addingSched ? 'Adding...' : '+ Add Schedule Entry'}
            </button>
          </div>
        </form>

        {schedule.length === 0 ? (
          <div className="table-empty-sm">No schedule entries yet. Add the first visit above.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((entry) => (
                  <tr key={entry.id}>
                    <td className="cell-strong">{entry.day_of_week}</td>
                    <td className="text-primary font-medium">{entry.start_time} – {entry.end_time}</td>
                    <td className="cell-muted">{entry.service || '—'}</td>
                    <td>
                      <span className={SCHEDULE_STATUS_BADGE[entry.status] || 'badge badge-blue'}>
                        {SCHEDULE_STATUS_LABELS[entry.status] || entry.status}
                      </span>
                    </td>
                    <td className="cell-muted">{entry.notes || '—'}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(entry)}
                        className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}