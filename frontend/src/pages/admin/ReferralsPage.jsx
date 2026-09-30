import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import usePaginatedFetch from '../../hooks/usePaginatedFetch';
import Pagination from '../../components/common/Pagination';

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
};

const STATUS_BADGE = {
  new: 'badge badge-blue',
  contacted: 'badge badge-yellow',
  converted: 'badge badge-green',
  closed: 'badge badge-gray',
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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Referral Inbox
          </h1>
          <p className="page-subtitle">
            Online care consultations, physician referrals, and Medicaid waiver inquiries from the public site.
          </p>
        </div>
        <span className="badge badge-blue">
          {total} total
        </span>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" className="alert alert-success flex items-center justify-between">
          <span>{successMsg}</span>
          {convertedClientId && (
            <Link to={`/admin/clients/${convertedClientId}`} className="underline font-semibold ml-3">
              View Client Profile & Admit →
            </Link>
          )}
        </div>
      )}

      {/* Confirmation Modal for Conversion */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full shadow-lg bg-white">
            <h3 className="section-title m-0 mb-2">Confirm Client Conversion</h3>
            <p className="text-sm text-secondary mb-4">
              Converting <strong>{confirmTarget.first_name} {confirmTarget.last_name}</strong> will automatically create a pending <strong>Client Profile</strong> and user portal account using their email (<code>{confirmTarget.email || 'N/A'}</code>).
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="btn-outline-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId === confirmTarget.id}
                onClick={() => executeStatusChange(confirmTarget, 'converted')}
                className="btn-success btn-sm"
              >
                {updatingId === confirmTarget.id ? 'Converting...' : 'Convert to Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
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
              className="filter-select"
            >
              <option value="all">All States</option>
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5 text-xs text-secondary cursor-pointer border border-gray-300 rounded px-2 py-1 bg-white">
              <input
                type="checkbox"
                checked={filterUnassigned}
                onChange={(e) => setFilterUnassigned(e.target.checked)}
              />
              Unassigned Only
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-reset"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="text-sm text-secondary">
            Showing <strong>{referrals.length}</strong> of <strong>{total}</strong> referrals
          </div>
        </div>

        {loading ? (
          <div className="table-loading-sm">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="table-empty-sm">
            {total === 0
              ? 'No referrals yet. New inquiries from the public contact forms will appear here.'
              : 'No referrals match the current filters.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
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
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-strong">
                      {r.first_name} {r.last_name}
                      <div className="cell-sub">
                        {r.phone || 'No phone'}
                        {r.email && ` · ${r.email}`}
                      </div>
                    </td>
                    <td className="cell-muted">
                      {r.states?.code || '—'}
                    </td>
                    <td>
                      <span className="chip-neutral">
                        {r.referral_source || 'Website Inquiry'}
                      </span>
                    </td>
                    <td className="cell-notes">
                      {r.notes ? (
                        <div className="truncate max-w-xs" title={r.notes}>{r.notes}</div>
                      ) : (
                        <span className="text-italic-muted">No notes</span>
                      )}
                    </td>
                    <td className="cell-notes">
                      <div
                        onClick={() => {
                          const val = window.prompt('Enter handling remarks / office notes:', r.handled_notes || '');
                          if (val !== null && val !== r.handled_notes) handleUpdateNotes(r.id, val);
                        }}
                        className="cursor-pointer hover:bg-gray-50 rounded p-1"
                        title="Click to edit handling remarks"
                      >
                        {r.handled_notes ? (
                          <div className="text-xs text-secondary">{r.handled_notes}</div>
                        ) : (
                          <span className="text-italic-muted text-xs">+ Add remarks</span>
                        )}
                      </div>
                    </td>

                    <td className="cell-muted whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={STATUS_BADGE[r.status] || 'badge badge-gray'}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                      {r.converted_client_id && (
                        <div className="mt-1">
                          <Link to={`/admin/clients/${r.converted_client_id}`} className="text-xs text-primary underline font-semibold">
                            View Client →
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <select
                        aria-label={`Update status for ${r.first_name} ${r.last_name}`}
                        value={r.status}
                        disabled={updatingId === r.id || r.status === 'converted'}
                        onChange={(e) => handleStatusSelect(r, e.target.value)}
                        className="filter-select text-xs"
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
    </div>
  );
}