import { CLIENT_STATUS_BADGE, CLIENT_STATUS_LABELS, ALLOWED_CLIENT_TRANSITIONS } from '../../constants/clientDetailConstants';

export default function AdmissionDecisionSection({
  client,
  serviceStartDate,
  setServiceStartDate,
  admissionNotes,
  setAdmissionNotes,
  rejectionReason,
  setRejectionReason,
  submittingAdmission,
  handleUpdateAdmission,
}) {
  const allowedTransitions = ALLOWED_CLIENT_TRANSITIONS[client.status || 'pending'] || [];

  return (
    <div className="card mb-6 p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="section-title m-0">Admission & Lifecycle Decision</h2>
        <span className={`badge ${CLIENT_STATUS_BADGE[client.status] || 'badge-neutral'} badge-lg`}>
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

      {allowedTransitions.includes('rejected') && (
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
        {allowedTransitions.map((targetStatus) => {
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
  );
}
