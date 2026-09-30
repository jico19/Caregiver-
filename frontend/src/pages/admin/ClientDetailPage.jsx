import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const CLIENT_STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  active: 'Active',
  discharged: 'Discharged',
  rejected: 'Rejected',
};

const CLIENT_STATUS_BADGE = {
  pending: 'badge badge-yellow',
  approved: 'badge badge-blue',
  active: 'badge badge-green',
  discharged: 'badge badge-gray',
  rejected: 'badge badge-red',
};

const ALLOWED_CLIENT_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['active', 'rejected', 'discharged'],
  active: ['discharged'],
  discharged: [],
  rejected: [],
};

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

  // Admission decision state
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

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

  // Caregiver assignment state
  const [assignments, setAssignments] = useState([]);
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState('');
  const [selectedRole, setSelectedRole] = useState('primary');
  const [assigning, setAssigning] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [res, planRes, schedRes, asgnRes, cgRes] = await Promise.all([
        api.get(`/admin/clients/${id}`, token),
        api.get(`/admin/clients/${id}/care-plan`, token),
        api.get(`/admin/clients/${id}/schedule`, token),
        api.get(`/admin/clients/${id}/assignments`, token),
        api.get(`/admin/caregivers`, token),
      ]);
      const c = res?.client || null;
      setClient(c);
      if (c) {
        setServiceStartDate(c.service_start_date || '');
        setAdmissionNotes(c.admission_notes || '');
        setRejectionReason(c.rejection_reason || '');
      }
      setSchedule(schedRes?.schedule || []);
      setAssignments(asgnRes?.assignments || []);
      const cgs = cgRes?.caregivers || (Array.isArray(cgRes) ? cgRes : []);
      setAvailableCaregivers(cgs);
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

  async function handleAssignCaregiver(e) {
    e.preventDefault();
    if (!selectedCaregiverId) return;
    setErrorMsg('');
    setSuccessMsg('');
    setAssigning(true);
    try {
      await api.post(
        `/admin/clients/${id}/assignments`,
        { caregiver_id: selectedCaregiverId, role: selectedRole },
        token
      );
      setSuccessMsg('Caregiver assigned successfully.');
      setSelectedCaregiverId('');
      await loadDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to assign caregiver.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleEndAssignment(caregiverId) {
    if (!window.confirm('End this caregiver assignment?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.delete(`/admin/clients/${id}/assignments/${caregiverId}`, token);
      setSuccessMsg('Caregiver assignment ended.');
      await loadDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to end caregiver assignment.');
    }
  }

  async function handleUpdateAdmission(targetStatus) {
    setErrorMsg('');
    setSuccessMsg('');
    if (targetStatus === 'rejected' && !rejectionReason.trim() && !admissionNotes.trim()) {
      setErrorMsg('A rejection reason is required when rejecting a client admission.');
      return;
    }
    setSubmittingAdmission(true);
    try {
      await api.post(
        `/admin/clients/${id}/admission`,
        {
          status: targetStatus,
          service_start_date: serviceStartDate || null,
          notes: admissionNotes.trim() || null,
          rejection_reason: targetStatus === 'rejected' ? (rejectionReason.trim() || admissionNotes.trim()) : null,
        },
        token
      );
      setSuccessMsg(`Client admission status updated to ${CLIENT_STATUS_LABELS[targetStatus] || targetStatus}.`);
      await loadDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update client admission status.');
    } finally {
      setSubmittingAdmission(false);
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

      {/* Admission & Lifecycle Panel */}
      <div className="card mb-6 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="section-title m-0">Admission & Lifecycle Decision</h2>
          <span className={`badge ${CLIENT_STATUS_BADGE[client.status] || 'badge badge-gray'} badge-lg`}>
            {CLIENT_STATUS_LABELS[client.status] || client.status || 'Pending'}
          </span>
        </div>

        <dl className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-4 text-xs">
          <div>
            <dt className="text-muted mb-1">Confirmed Service Start Date</dt>
            <dd className="font-semibold text-sm">
              {client.service_start_date ? new Date(client.service_start_date).toLocaleDateString() : 'Not Set'}
            </dd>
          </div>
          <div>
            <dt className="text-muted mb-1">Admitted / Reviewed By</dt>
            <dd className="font-semibold text-sm">{client.admitted_by || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted mb-1">Admitted / Reviewed At</dt>
            <dd className="font-semibold text-sm">
              {client.admitted_at ? new Date(client.admitted_at).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>

        {client.rejection_reason && (
          <div role="alert" className="alert alert-error mb-4">
            <strong>Rejection Reason:</strong> {client.rejection_reason}
          </div>
        )}

        <div className="form-grid-2 gap-4 mt-2">
          <div>
            <label htmlFor="service-start-date">Confirmed Service Start Date</label>
            <input
              id="service-start-date"
              type="date"
              value={serviceStartDate}
              onChange={(e) => setServiceStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admission-notes">Admission Review Notes</label>
            <input
              id="admission-notes"
              type="text"
              value={admissionNotes}
              onChange={(e) => setAdmissionNotes(e.target.value)}
              placeholder="Internal review notes or coordinator remarks"
            />
          </div>
        </div>

        {(ALLOWED_CLIENT_TRANSITIONS[client.status || 'pending'] || []).includes('rejected') && (
          <div className="mt-3">
            <label htmlFor="rejection-reason-input">Rejection Reason (Required if rejecting)</label>
            <input
              id="rejection-reason-input"
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="State reason for rejecting admission (e.g. Ineligible coverage, out of jurisdiction)"
              className="w-full"
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {(ALLOWED_CLIENT_TRANSITIONS[client.status || 'pending'] || []).map((targetStatus) => {
            const labelMap = {
              approved: 'Approve Admission',
              active: 'Mark Service Active',
              discharged: 'Discharge Client',
              rejected: 'Reject Admission',
            };
            const btnClassMap = {
              approved: 'btn-success',
              active: 'btn-primary',
              discharged: 'btn-outline-secondary',
              rejected: 'btn-danger border border-red-300 text-red-600 bg-white hover:bg-red-50',
            };
            return (
              <button
                key={targetStatus}
                type="button"
                disabled={submittingAdmission}
                onClick={() => handleUpdateAdmission(targetStatus)}
                className={`btn-sm ${btnClassMap[targetStatus] || 'btn-primary'}`}
              >
                {submittingAdmission ? 'Updating...' : labelMap[targetStatus] || targetStatus}
              </button>
            );
          })}
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

      {/* Caregiver Assignments */}
      <div className="card p-5 mt-6">
        <h2 className="section-title m-0 mb-4">
          Assigned Caregivers ({assignments.length})
        </h2>

        <form onSubmit={handleAssignCaregiver} className="bg-gray-50 border p-4 rounded mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <label htmlFor="assign-cg" className="block text-sm font-medium mb-1">Select Caregiver</label>
              <select
                id="assign-cg"
                required
                value={selectedCaregiverId}
                onChange={(e) => setSelectedCaregiverId(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="">-- Choose Caregiver --</option>
                {availableCaregivers.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.first_name} {cg.last_name} ({cg.ssn_last4 ? `SSN: ***-${cg.ssn_last4}` : cg.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="assign-role" className="block text-sm font-medium mb-1">Assignment Role</label>
              <select
                id="assign-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="primary">Primary Caregiver</option>
                <option value="backup">Backup Caregiver</option>
                <option value="relief">Relief Caregiver</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={assigning || !selectedCaregiverId} className="btn-primary w-full">
                {assigning ? 'Assigning...' : '+ Assign Caregiver'}
              </button>
            </div>
          </div>
        </form>

        {assignments.length === 0 ? (
          <div className="table-empty-sm">No caregivers assigned yet. Assign a caregiver above.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Assigned Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asg) => {
                  const cg = asg.caregivers;
                  const cgId = asg.caregiver_id || cg?.id;
                  return (
                    <tr key={asg.id}>
                      <td className="cell-strong">
                        {cg ? (
                          <Link to={`/admin/caregivers/${cg.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                            {cg.first_name} {cg.last_name}
                          </Link>
                        ) : (cgId || 'Caregiver')}
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>
                          {asg.role || 'primary'}
                        </span>
                      </td>
                      <td className="cell-muted">{cg?.phone || '—'}</td>
                      <td className="cell-muted">
                        {asg.assigned_at ? new Date(asg.assigned_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleEndAssignment(cgId)}
                          className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                        >
                          End Assignment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}