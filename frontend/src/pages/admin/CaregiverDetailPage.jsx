import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { STATUS_META } from '../../utils/caregiverStatus';

function badgeClass(status) {
  const meta = STATUS_META[status];
  return meta ? `badge ${meta.badge}` : 'badge badge-gray';
}

const NEXT_ACTIONS = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['onboarding'],
  rejected: [],
  onboarding: [],
  draft: ['submitted'],
};

const ACTION_LABELS = {
  submitted: 'Start Review',
  under_review: 'Mark Under Review',
  approved: 'Approve & Move to Onboarding',
  rejected: 'Reject',
  onboarding: 'Complete Onboarding',
};

export default function CaregiverDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();

  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [pendingStatus, setPendingStatus] = useState(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [detailRes, docRes] = await Promise.all([
        api.get(`/admin/caregivers/${id}`, token),
        api.get(`/admin/caregivers/${id}/documents`, token),
      ]);
      setApplication(detailRes?.application || null);
      setEnrollments(detailRes?.enrollments || []);
      setDocuments(docRes?.documents || []);
      if (!detailRes?.application) setErrorMsg('Application not found.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && id) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  function openAction(status) {
    setPendingStatus(status);
    setReason('');
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function confirmAction() {
    if (!pendingStatus) return;

    if (pendingStatus === 'rejected' && !reason.trim()) {
      setErrorMsg('A rejection reason is required before rejecting an application.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.post(
        `/admin/caregivers/${id}/review`,
        { status: pendingStatus, notes: reason.trim() || null },
        token
      );
      setSuccessMsg(`Application moved to "${STATUS_META[pendingStatus]?.label || pendingStatus.replace('_', ' ')}".`);
      setPendingStatus(null);
      await loadDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update application status.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="table-loading-sm">Loading application details...</div>;
  }

  if (!application) {
    return (
      <div className="page-container">
        <div role="alert" className="alert alert-error">Application not found.</div>
        <Link to="/admin/caregivers" className="text-sm font-semibold text-primary">
          ← Back to Caregiver Applications
        </Link>
      </div>
    );
  }

  const caregiver = application.caregivers || {};
  const userAccount = application.users || {};
  const state = application.states ? `${application.states.name || ''} (${application.states.code || ''})` : '—';
  const nextActions = NEXT_ACTIONS[application.status] || [];
  const canReview = nextActions.length > 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Application Review
          </h1>
          <p className="page-subtitle">
            <Link to="/admin/caregivers" className="text-sm font-semibold text-primary">
              ← Back to Caregiver Applications
            </Link>
          </p>
        </div>
        <span className={`badge ${badgeClass(application.status)} badge-lg`}>
          {(STATUS_META[application.status]?.label || application.status).toUpperCase()}
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

      {/* Review Action Panel */}
      {canReview && (
        <div className="admin-card mb-6 p-5">
          <h2 className="section-title m-0 mb-3">Review Decision</h2>

          {pendingStatus ? (
            <div className="card-muted p-4">
              <h3 className="font-semibold text-sm mb-2">
                {pendingStatus === 'rejected' ? 'Reject Application' : ACTION_LABELS[pendingStatus]}
              </h3>

              {pendingStatus === 'rejected' && (
                <div className="mb-4">
                  <label htmlFor="rejection-reason">
                    Rejection Reason (required, shown to the caregiver)
                  </label>
                  <textarea
                    id="rejection-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="E.g., Background check pending / expired certification / incomplete information — the applicant will see this when they resubmit."
                  />
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmAction}
                  className={pendingStatus === 'rejected' ? 'btn-reject' : 'btn-approve'}
                >
                  {actionLoading ? 'Updating...' : `Confirm ${ACTION_LABELS[pendingStatus]}`}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setPendingStatus(null)}
                  className="btn-outline-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {nextActions.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={actionLoading}
                  onClick={() => openAction(status)}
                  className={status === 'rejected' ? 'btn-reject' : 'btn-approve'}
                >
                  {ACTION_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applicant Details */}
      <div className="card mb-6 p-5">
        <h2 className="section-title m-0 mb-4">Applicant Details</h2>

        <dl className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-4">
          <div>
            <dt className="text-xs text-muted mb-1">Full Name</dt>
            <dd className="text-sm font-semibold">
              {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name || ''}` : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Portal Email</dt>
            <dd className="text-sm font-semibold">{userAccount.email || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Phone</dt>
            <dd className="text-sm font-semibold">{caregiver.phone || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">State Office</dt>
            <dd className="text-sm font-semibold">{state}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Date of Birth</dt>
            <dd className="text-sm font-semibold">
              {caregiver.date_of_birth ? new Date(caregiver.date_of_birth).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted mb-1">Submitted</dt>
            <dd className="text-sm font-semibold">
              {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>

        {caregiver.address && (
          <div className="mb-2">
            <dt className="text-xs text-muted mb-1">Address</dt>
            <dd className="text-sm text-secondary">{caregiver.address}</dd>
          </div>
        )}
        {application.notes && (
          <div>
            <dt className="text-xs text-muted mb-1">Experience & Notes</dt>
            <dd className="text-sm text-secondary leading-normal">{application.notes}</dd>
          </div>
        )}
        {application.rejection_reason && (
          <div className="alert alert-error mt-4">
            <strong>Previous rejection reason:</strong> {application.rejection_reason}
          </div>
        )}
      </div>

      {/* Uploaded Documents */}
      <div className="card mb-6 p-5">
        <h2 className="section-title m-0 mb-4">
          Uploaded Credentials & Documents ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <div className="table-empty-sm">No documents uploaded yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="cell-strong">
                      {doc.document_types?.name || 'Unknown type'}
                    </td>
                    <td>
                      <span className={`badge ${doc.status === 'approved' ? 'badge-green' : doc.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {doc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="cell-muted">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Training Enrollments */}
      <div className="card p-5">
        <h2 className="section-title m-0 mb-4">
          Assigned Training ({enrollments.length})
        </h2>

        {enrollments.length === 0 ? (
          <div className="table-empty-sm">No training courses assigned yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => (
                  <tr key={enr.id}>
                    <td className="cell-strong">
                      {enr.training_courses?.name || 'Course'}
                    </td>
                    <td>
                      <span className={`badge ${enr.progress >= 100 ? 'badge-green' : enr.progress > 0 ? 'badge-yellow' : 'badge-gray'}`}>
                        {enr.progress ?? 0}%
                      </span>
                    </td>
                    <td className="cell-muted">
                      {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString() : '—'}
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