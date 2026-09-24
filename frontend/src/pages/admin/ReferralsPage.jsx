import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
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

const STATE_CODE_MAP = {
  1: 'FL',
  2: 'IN',
  3: 'GA',
};

export default function ReferralsPage() {
  const { token } = useAuth();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const params = {
    status: filterStatus,
    state_id: filterState === 'all' ? '' : filterState,
  };

  const {
    items: referrals,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    reload,
  } = usePaginatedFetch({
    url: '/admin/referrals',
    token,
    params,
    listKey: 'referrals',
  });

  function handleResetFilters() {
    setFilterStatus('all');
    setFilterState('all');
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function handleStatusChange(referralId, status) {
    setUpdatingId(referralId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.patch(`/admin/referrals/${referralId}`, { status }, token);
      setSuccessMsg(`Referral marked as "${STATUS_LABELS[status]}".`);
      reload();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update referral status.');
    } finally {
      setUpdatingId(null);
    }
  }

  const hasActiveFilters = filterStatus !== 'all' || filterState !== 'all';

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
        <div role="status" className="alert alert-success">
          {successMsg}
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
              <option value="1">Florida (FL)</option>
              <option value="2">Indiana (IN)</option>
              <option value="3">Georgia (GA)</option>
            </select>

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
                  <th>Notes</th>
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
                      {r.states?.code || STATE_CODE_MAP[r.state_id] || '—'}
                    </td>
                    <td>
                      <span className="chip-neutral">
                        {r.referral_source || 'Website Inquiry'}
                      </span>
                    </td>
                    <td className="cell-notes">
                      {r.notes ? (
                        <div className="truncate" title={r.notes}>{r.notes}</div>
                      ) : (
                        <span className="text-italic-muted">No notes</span>
                      )}
                    </td>
                    <td className="cell-muted whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={STATUS_BADGE[r.status] || 'badge badge-gray'}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <select
                        aria-label={`Update status for ${r.first_name} ${r.last_name}`}
                        value={r.status}
                        disabled={updatingId === r.id}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        className="filter-select"
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
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