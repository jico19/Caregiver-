import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
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
  const authorizations = useMemo(() => data?.authorizations || (Array.isArray(data) ? data : []), [data]);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Summarize active care allowances
  const activeAuths = useMemo(() => {
    return authorizations.filter((a) => a.status === 'active' || a.status === 'expiring_soon');
  }, [authorizations]);

  const { totalRemainingHours, totalAuthorizedHours, totalUsedHours, totalRemainingUnits, totalAuthorizedUnits } = useMemo(() => {
    let remH = 0;
    let authH = 0;
    let usedH = 0;
    let remU = 0;
    let authU = 0;

    for (const a of activeAuths) {
      const uTotal = a.total_units_authorized ?? 0;
      const uUsed = a.units_used ?? 0;
      const uRem = a.units_remaining ?? (uTotal - uUsed);
      const is15Min = (a.unit_type || '15_min') === '15_min';

      const rHours = a.remaining_hours !== undefined ? a.remaining_hours : (is15Min ? uRem * 0.25 : uRem);
      const tHours = a.total_hours !== undefined ? a.total_hours : (is15Min ? uTotal * 0.25 : uTotal);
      const usHours = a.hours_used !== undefined ? a.hours_used : (is15Min ? uUsed * 0.25 : uUsed);

      remH += Number(rHours) || 0;
      authH += Number(tHours) || 0;
      usedH += Number(usHours) || 0;
      remU += Number(uRem) || 0;
      authU += Number(uTotal) || 0;
    }

    return {
      totalRemainingHours: remH,
      totalAuthorizedHours: authH,
      totalUsedHours: usedH,
      totalRemainingUnits: remU,
      totalAuthorizedUnits: authU,
    };
  }, [activeAuths]);

  const overallPercent = totalAuthorizedHours > 0
    ? Math.min(100, Math.round((totalUsedHours / totalAuthorizedHours) * 100))
    : 0;

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
      render: (val) => <span className="font-semibold text-slate-900 font-mono text-xs">{val}</span>,
    },
    {
      key: 'procedure',
      label: 'Service & Procedure',
      render: (_, row) => (
        <div>
          <div className="font-medium text-slate-900 text-xs flex items-center gap-1.5">
            <span className="badge badge-xs badge-outline font-mono font-bold text-primary">
              {row.hcpcs_code || 'T1019'}
            </span>
            <span>{row.service_description || 'Personal Care Services'}</span>
          </div>
          {row.max_weekly_hours ? (
            <div className="text-[11px] text-slate-500 mt-0.5">
              Weekly limit: {row.max_weekly_hours} hrs/week
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'allowance',
      label: 'Care Allowance & Balance',
      render: (_, row) => {
        const total = row.total_units_authorized ?? 0;
        const used = row.units_used ?? 0;
        const remaining = row.units_remaining ?? (total - used);
        const is15Min = (row.unit_type || '15_min') === '15_min';
        const remHours = row.remaining_hours !== undefined
          ? row.remaining_hours
          : (is15Min ? (remaining * 0.25).toFixed(1) : remaining);
        const totalHours = row.total_hours !== undefined
          ? row.total_hours
          : (is15Min ? (total * 0.25).toFixed(1) : total);
        const isOver = used > total;
        const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
        const progressColor = isOver || pct >= 90 ? 'progress-error' : (pct >= 75 ? 'progress-warning' : 'progress-primary');

        return (
          <div className="w-40">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className={`font-bold ${Number(remHours) < 0 ? 'text-error' : 'text-slate-800'}`}>
                {Number(remHours) < 0 ? `${Math.abs(Number(remHours))} hrs over` : `${remHours} hrs left`}
              </span>
              <span className="text-slate-500 text-[11px]">
                {used} / {total} u
              </span>
            </div>
            <progress
              className={`progress ${progressColor} h-2 w-full`}
              value={pct}
              max="100"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
              <span>{pct}% used</span>
              <span>{totalHours} hrs total</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'state',
      label: 'State',
      render: (_, row) => <span className="badge badge-sm badge-ghost">{row.states?.code || 'State'}</span>,
    },
    {
      key: 'dates',
      label: 'Effective Window',
      render: (_, row) => {
        const isExpiringSoon = row.days_until_expiration !== null && row.days_until_expiration <= 30;
        return (
          <div className="text-slate-600 whitespace-nowrap text-xs">
            <div>{row.start_date} to {row.end_date}</div>
            {isExpiringSoon && row.days_until_expiration !== null && row.status === 'active' && (
              <span className="block text-[11px] font-semibold text-orange-600 mt-0.5">
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
            className="btn btn-ghost btn-xs text-primary hover:text-primary font-semibold"
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
        subtitle="Official state approvals governing covered care hours, HCPCS procedure codes, and weekly limits."
        actions={
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            {showUpload ? <><X size={14} /> Close Upload</> : <><Plus size={14} /> Upload Document</>}
          </button>
        }
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg || fetchError}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      {/* Active Care Allowance Summary Cards */}
      {activeAuths.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className={`p-4 ${totalRemainingHours < 0 ? 'bg-error/5 border border-error/20' : 'bg-primary/5 border border-primary/20'}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Remaining Care Allowance
            </div>
            <div className={`text-2xl font-bold ${totalRemainingHours < 0 ? 'text-error' : 'text-primary'} mt-1`}>
              {totalRemainingHours < 0 ? `-${Math.abs(totalRemainingHours).toFixed(1)}` : totalRemainingHours.toFixed(1)}{' '}
              <span className="text-sm font-normal text-slate-600">Hours</span>
            </div>
            <div className={`text-xs mt-1 ${totalRemainingUnits < 0 ? 'text-error font-medium' : 'text-slate-500'}`}>
              {totalRemainingUnits < 0
                ? `${Math.abs(totalRemainingUnits)} billing units over allowance`
                : `${totalRemainingUnits} billing units remaining`}
            </div>
          </Card>

          <Card className="p-4 bg-base-100 border border-base-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Authorized Hours
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {totalAuthorizedHours.toFixed(1)} <span className="text-sm font-normal text-slate-600">Hours</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {totalAuthorizedUnits} units across {activeAuths.length} active approval{activeAuths.length > 1 ? 's' : ''}
            </div>
          </Card>

          <Card className="p-4 bg-base-100 border border-base-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hours Consumed
            </div>
            <div className="text-2xl font-bold text-slate-700 mt-1">
              {totalUsedHours.toFixed(1)} <span className="text-sm font-normal text-slate-600">Hours</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {overallPercent}% total utilization
            </div>
          </Card>
        </div>
      )}

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
