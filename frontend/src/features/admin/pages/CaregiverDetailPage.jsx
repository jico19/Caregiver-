import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';
import { STATUS_META } from '../../../shared/utils/caregiverStatus';

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
  approved: 'Approve Application',
  rejected: 'Reject Application',
  onboarding: 'Confirm Complete Onboarding',
};

export default function CaregiverDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();

  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
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
      const [detailRes, docRes, asgnRes] = await Promise.all([
        api.get(`/admin/caregivers/${id}`, token),
        api.get(`/admin/caregivers/${id}/documents`, token).catch(() => ({ documents: [] })),
        api.get(`/admin/caregivers/${id}/assignments`, token).catch(() => ({ assignments: [] })),
      ]);
      setApplication(detailRes?.application || null);
      setEnrollments(detailRes?.enrollments || []);
      setDocuments(docRes?.documents || []);
      setAssignments(asgnRes?.assignments || []);
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
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">Loading application details...</div>
      </PageContainer>
    );
  }

  if (!application) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-error mb-4">
          <span>Application not found.</span>
        </div>
        <Link to="/admin/caregivers" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to Caregiver Applications
        </Link>
      </PageContainer>
    );
  }

  const caregiver = application.caregivers || {};
  const userAccount = application.users || {};
  const state = application.states ? `${application.states.name || ''} (${application.states.code || ''})` : '—';
  const nextActions = NEXT_ACTIONS[application.status] || [];
  const canReview = nextActions.length > 0;

  return (
    <PageContainer>
      <div className="mb-2">
        <Link to="/admin/caregivers" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to Caregiver Applications
        </Link>
      </div>

      <PageHeader
        title="Application Review"
        subtitle={`Candidate: ${caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name || ''}` : 'Applicant'}`}
        actions={
          <StatusBadge
            status={application.status}
            label={STATUS_META[application.status]?.label || application.status.replace('_', ' ')}
          />
        }
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Review Action Panel */}
      {canReview && (
        <Card className="mb-6 p-5">
          <h2 className="font-semibold text-base text-slate-900 m-0 mb-3">Review Decision</h2>

          {pendingStatus ? (
            <div className="p-4 rounded border border-base-300 bg-base-200/40">
              <h3 className="font-semibold text-sm text-slate-900 mb-2">
                {pendingStatus === 'rejected' ? 'Reject Application' : ACTION_LABELS[pendingStatus]}
              </h3>

              {pendingStatus === 'rejected' && (
                <div className="mb-4">
                  <FormField
                    label="Rejection Reason (required, shown to the caregiver)"
                    id="rejection-reason"
                    required
                  >
                    <textarea
                      id="rejection-reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="textarea textarea-bordered w-full text-sm"
                      placeholder="E.g., Background check pending / expired certification / incomplete information — the applicant will see this when they resubmit."
                    />
                  </FormField>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmAction}
                  className={`btn btn-sm ${pendingStatus === 'rejected' ? 'btn-error' : 'btn-primary'}`}
                >
                  {actionLoading ? 'Updating...' : `Confirm ${ACTION_LABELS[pendingStatus]}`}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setPendingStatus(null)}
                  className="btn btn-outline btn-sm"
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
                  className={`btn btn-sm ${status === 'rejected' ? 'btn-outline text-red-600 hover:bg-red-50 hover:border-red-300' : 'btn-primary'}`}
                >
                  {ACTION_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Applicant Details */}
      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-base text-slate-900 m-0 mb-4">Applicant Details</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Full Name</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name || ''}` : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Portal Email</dt>
            <dd className="text-sm font-semibold text-slate-900">{userAccount.email || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Phone</dt>
            <dd className="text-sm font-semibold text-slate-900">{caregiver.phone || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">State Office</dt>
            <dd className="text-sm font-semibold text-slate-900">{state}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Date of Birth</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {caregiver.date_of_birth ? new Date(caregiver.date_of_birth).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Submitted</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : '—'}
            </dd>
          </div>
        </dl>

        {caregiver.address && (
          <div className="mb-3 pt-3 border-t border-base-300">
            <dt className="text-xs text-slate-400 mb-0.5">Address</dt>
            <dd className="text-xs text-slate-700 leading-normal">{caregiver.address}</dd>
          </div>
        )}
        {application.notes && (
          <div className="mb-3 pt-3 border-t border-base-300">
            <dt className="text-xs text-slate-400 mb-0.5">Experience & Notes</dt>
            <dd className="text-xs text-slate-700 leading-normal">{application.notes}</dd>
          </div>
        )}
        {application.rejection_reason && (
          <div role="alert" className="alert alert-error mt-4">
            <span><strong>Previous rejection reason:</strong> {application.rejection_reason}</span>
          </div>
        )}
      </Card>

      {/* Uploaded Documents */}
      <Card className="mb-6 p-0 overflow-hidden">
        <div className="p-4 border-b border-base-300">
          <h2 className="font-semibold text-base text-slate-900 m-0">
            Uploaded Credentials & Documents ({documents.length})
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No documents uploaded"
              description="No documents uploaded yet for this applicant."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                  <th>Document Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                    <td className="font-semibold text-slate-900 text-xs">
                      {doc.document_types?.name || 'Unknown type'}
                    </td>
                    <td>
                      <StatusBadge status={doc.status} label={doc.status.replace('_', ' ')} />
                    </td>
                    <td className="text-slate-600 text-xs">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Training Enrollments */}
      <Card className="mb-6 p-0 overflow-hidden">
        <div className="p-4 border-b border-base-300">
          <h2 className="font-semibold text-base text-slate-900 m-0">
            Assigned Training ({enrollments.length})
          </h2>
        </div>

        {enrollments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No training courses assigned"
              description="No training courses assigned yet for this applicant."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                    <td className="font-semibold text-slate-900 text-xs">
                      {enr.training_courses?.name || 'Course'}
                    </td>
                    <td>
                      <span className="badge badge-soft text-slate-700 text-xs">
                        {enr.progress ?? 0}%
                      </span>
                    </td>
                    <td className="text-slate-600 text-xs">
                      {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assigned Clients */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-base-300">
          <h2 className="font-semibold text-base text-slate-900 m-0">
            Assigned Clients ({assignments.length})
          </h2>
        </div>

        {assignments.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No assigned clients"
              description="No clients assigned to this caregiver yet."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                  <th>Client</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Assigned Date</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asg) => {
                  const client = asg.clients;
                  return (
                    <tr key={asg.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                      <td className="font-semibold text-slate-900 text-xs">
                        {client ? (
                          <Link
                            to={`/admin/clients/${client.id}`}
                            className="text-emerald-700 hover:text-emerald-800 underline"
                          >
                            {client.first_name} {client.last_name}
                          </Link>
                        ) : 'Client'}
                      </td>
                      <td>
                        <span className="badge badge-soft text-slate-700 text-xs capitalize">
                          {asg.role || 'primary'}
                        </span>
                      </td>
                      <td className="text-slate-600 text-xs">{client?.phone || '—'}</td>
                      <td className="text-slate-600 text-xs">
                        {asg.assigned_at ? new Date(asg.assigned_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
