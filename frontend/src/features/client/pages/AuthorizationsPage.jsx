import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import { downloadDocument } from '../../../shared/utils/documentUtils';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import DataTable from '../../../shared/components/common/DataTable';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import Toast from '../../../shared/components/common/Toast';
import LoadingState from '../../../shared/components/common/LoadingState';

export default function AuthorizationsPage() {
  const { token } = useAuth();
  const { data, isLoading: loading, error: fetchError, refetch } = useFetch('/clients/me/authorizations', {
    enabled: !!token,
    defaultData: { authorizations: [] },
  });
  const authorizations = data?.authorizations || (Array.isArray(data) ? data : []);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!file) {
      setErrorMsg('Please select the authorization document to upload.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Service start and end dates are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      if (notes.trim()) formData.append('notes', notes.trim());

      const res = await api.upload('/clients/me/authorizations', formData, token);
      setToastMsg(`Authorization ${res?.authorization?.authorization_number || ''} submitted for review.`);
      setShowUpload(false);
      setFile(null);
      setStartDate('');
      setEndDate('');
      setNotes('');
      await refetch();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit your authorization document.');
    } finally {
      setSubmitting(false);
    }
  }

  function openDocument(documentId) {
    if (!documentId) return;
    downloadDocument(documentId, token);
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading Service Authorizations..."
        subtitle="Retrieving state approval records..."
        variant="page"
      />
    );
  }

  const columns = [
    {
      key: 'authorization_number',
      label: 'Authorization #',
      render: (val) => <span className="font-semibold text-slate-900">{val}</span>,
    },
    {
      key: 'state',
      label: 'State',
      render: (_, row) => <span className="text-slate-600">{row.states?.code || 'State'}</span>,
    },
    {
      key: 'dates',
      label: 'Effective Window',
      render: (_, row) => {
        const isExpiringSoon = row.days_until_expiration !== null && row.days_until_expiration <= 30;
        return (
          <div className="text-slate-600 whitespace-nowrap">
            <span>{row.start_date} to {row.end_date}</span>
            {isExpiringSoon && row.days_until_expiration !== null && row.status === 'active' && (
              <span className="block text-xs font-semibold text-orange-600">
                {row.days_until_expiration} days remaining
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} size="xs" />,
    },
    {
      key: 'source',
      label: 'Source',
      render: (val) => <span className="text-xs text-slate-500">{val === 'client' ? 'Self-Submitted' : 'State / Agency'}</span>,
    },
    {
      key: 'document',
      label: 'Document',
      render: (_, row) =>
        row.document_id ? (
          <button
            type="button"
            onClick={() => openDocument(row.document_id)}
            className="btn btn-ghost btn-xs text-green-700 hover:text-green-800 font-semibold"
          >
            View File ↓
          </button>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (val) => <span className="text-xs text-slate-500">{val || 'Routine authorization'}</span>,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Medicaid & Insurance Authorizations"
        subtitle="Official state authorizations governing covered hours, service periods, and home care provisions."
        actions={
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="btn btn-primary btn-sm"
          >
            {showUpload ? 'Close Upload' : 'Upload Document +'}
          </button>
        }
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg || fetchError}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      {showUpload && (
        <Card title="Submit Authorization Document" className="mb-6">
          <form onSubmit={handleUpload} className="flex flex-col gap-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Authorization Document (PDF, PNG, JPG)" htmlFor="auth-upload-file" required>
                <input
                  id="auth-upload-file"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  className="file-input file-input-bordered file-input-sm w-full"
                />
              </FormField>

              <FormField label="Service Start Date" htmlFor="auth-upload-start" required>
                <input
                  id="auth-upload-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input input-bordered w-full"
                />
              </FormField>

              <FormField label="Service End Date" htmlFor="auth-upload-end" required>
                <input
                  id="auth-upload-end"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input input-bordered w-full"
                />
              </FormField>
            </div>

            <FormField label="Notes (optional)" htmlFor="auth-upload-notes">
              <input
                id="auth-upload-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Renewal for 2026, home health aide 20 hrs/wk"
                className="input input-bordered w-full"
              />
            </FormField>

            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setShowUpload(false)} className="btn btn-ghost btn-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Authorization Records (${authorizations.length})`}>
        {authorizations.length === 0 ? (
          <EmptyState
            title="No Authorizations on File"
            description="Authorizations are generated once your intake details, physician orders, and Medicaid eligibility have been reviewed by your coordinator."
            action={
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowUpload(true)} className="btn btn-primary btn-sm">
                  Upload Document
                </button>
                <Link to="/client/intake" className="btn btn-outline btn-sm text-slate-700">
                  Complete Intake
                </Link>
              </div>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={authorizations}
            keyField="id"
          />
        )}
      </Card>
    </PageContainer>
  );
}
