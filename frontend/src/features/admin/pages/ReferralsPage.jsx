import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import useFetch from '../../../shared/hooks/useFetch';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import ConfirmModal from '../../../shared/components/common/ConfirmModal';
import Pagination from '../../../shared/components/common/Pagination';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
};

export default function ReferralsPage() {
  const { token } = useAuth();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [convertedClientId, setConvertedClientId] = useState(null);

  // Confirmation Modal State for Conversion
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Fetch states list dynamically (no hardcoded state IDs)
  const { data: statesData } = useFetch('/states', { defaultData: [] });
  const states = Array.isArray(statesData) ? statesData : statesData?.states || [];

  const params = {
    status: filterStatus === 'all' ? '' : filterStatus,
    state_id: filterState === 'all' ? '' : filterState,
    ...(filterUnassigned ? { unassigned: 'true' } : {}),
  };

  const {
    items: referrals,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    reload,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/referrals',
    token,
    params,
    listKey: 'referrals',
  });

  function handleResetFilters() {
    setFilterStatus('all');
    setFilterState('all');
    setFilterUnassigned(false);
    setErrorMsg('');
    setSuccessMsg('');
    setConvertedClientId(null);
  }

  async function executeStatusChange(referral, targetStatus) {
    setUpdatingId(referral.id);
    setErrorMsg('');
    setSuccessMsg('');
    setConvertedClientId(null);
    try {
      const res = await api.patch(`/admin/referrals/${referral.id}`, { status: targetStatus }, token);
      if (targetStatus === 'converted' && res?.client_id) {
        setConvertedClientId(res.client_id);
        setSuccessMsg(`Referral for ${referral.first_name} ${referral.last_name} converted to client profile.`);
      } else {
        setSuccessMsg(`Referral marked as "${STATUS_LABELS[targetStatus]}".`);
      }
      reload();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update referral status.');
    } finally {
      setUpdatingId(null);
      setConfirmTarget(null);
    }
  }

  function handleStatusSelect(referral, targetStatus) {
    if (targetStatus === 'converted') {
      setConfirmTarget(referral);
    } else {
      executeStatusChange(referral, targetStatus);
    }
  }

  async function handleUpdateNotes(referralId, notes) {
    try {
      await api.patch(`/admin/referrals/${referralId}`, { handled_notes: notes }, token);
      reload();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to save notes.');
    }
  }

  const hasActiveFilters = filterStatus !== 'all' || filterState !== 'all' || filterUnassigned;

  return (
    <PageContainer>
      <PageHeader
        title="Referral Inbox"
        description="Online care consultations, physician referrals, and Medicaid waiver inquiries from the public site."
        badge={`${total} total`}
        badgeVariant="neutral"
      />

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" className="alert alert-success mb-4 flex items-center justify-between text-sm py-2 px-4 rounded-box">
          <span>{successMsg}</span>
          {convertedClientId && (
            <Link to={`/admin/clients/${convertedClientId}`} className="link link-hover font-semibold ml-3">
              View Client Profile & Admit →
            </Link>
          )}
        </div>
      )}

      {/* Confirmation Modal for Conversion */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        title="Confirm Client Conversion"
        message={
          confirmTarget
            ? `Converting ${confirmTarget.first_name} ${confirmTarget.last_name} will automatically create a pending Client Profile and user portal account using their email (${confirmTarget.email || 'N/A'}).`
            : ''
        }
        confirmText="Convert to Client"
        confirmVariant="primary"
        loading={updatingId === confirmTarget?.id}
        onConfirm={() => executeStatusChange(confirmTarget, 'converted')}
        onClose={() => setConfirmTarget(null)}
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="select select-bordered select-sm text-sm"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <select
              aria-label="Filter by state"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="select select-bordered select-sm text-sm"
            >
              <option value="all">All States</option>
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer border border-base-300 rounded px-2.5 py-1.5 bg-base-100 hover:bg-base-200/50">
              <input
                type="checkbox"
                checked={filterUnassigned}
                onChange={(e) => setFilterUnassigned(e.target.checked)}
                className="checkbox checkbox-primary checkbox-xs"
              />
              Unassigned Only
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-ghost btn-sm text-slate-600 hover:text-slate-900"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-900">{referrals.length}</strong> of <strong className="text-slate-900">{total}</strong> referrals
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {total === 0
              ? 'No referrals yet. New inquiries from the public contact forms will appear here.'
              : 'No referrals match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Lead</th>
                  <th>State</th>
                  <th>Source</th>
                  <th>Inquiry Notes</th>
                  <th>Handling Remarks</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-base-200/40 transition-colors">
                    <td>
                      <div className="font-medium text-slate-900">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.phone || 'No phone'}
                        {r.email && ` · ${r.email}`}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">
                        {r.states?.code || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-neutral badge-soft">
                        {r.referral_source || 'Website Inquiry'}
                      </span>
                    </td>
                    <td className="max-w-xs text-xs">
                      {r.notes ? (
                        <div className="truncate text-slate-600" title={r.notes}>{r.notes}</div>
                      ) : (
                        <span className="text-slate-400 italic">No notes</span>
                      )}
                    </td>
                    <td className="max-w-xs text-xs">
                      <div
                        onClick={() => {
                          const val = window.prompt('Enter handling remarks / office notes:', r.handled_notes || '');
                          if (val !== null && val !== r.handled_notes) handleUpdateNotes(r.id, val);
                        }}
                        className="cursor-pointer hover:bg-base-200/70 rounded p-1"
                        title="Click to edit handling remarks"
                      >
                        {r.handled_notes ? (
                          <div className="text-xs text-slate-700">{r.handled_notes}</div>
                        ) : (
                          <span className="text-slate-400 italic text-xs hover:text-primary">+ Add remarks</span>
                        )}
                      </div>
                    </td>

                    <td className="text-slate-500 whitespace-nowrap text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={r.status} label={STATUS_LABELS[r.status] || r.status} />
                      {r.converted_client_id && (
                        <div className="mt-1">
                          <Link to={`/admin/clients/${r.converted_client_id}`} className="text-xs text-primary font-semibold hover:underline">
                            View Client →
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <select
                        aria-label={`Update status for ${r.first_name} ${r.last_name}`}
                        value={r.status}
                        disabled={updatingId === r.id || r.status === 'converted'}
                        onChange={(e) => handleStatusSelect(r, e.target.value)}
                        className="select select-bordered select-xs"
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val} disabled={val === 'converted' && r.converted_client_id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-base-200">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            listLabel="referrals"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </PageContainer>
  );
}
