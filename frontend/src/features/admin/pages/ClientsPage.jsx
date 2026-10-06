import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import Pagination from '../../../shared/components/common/Pagination';

import { CLIENT_STATUS_LABELS, CLIENT_STATUS_BADGE } from '../../../shared/constants/clientStatus';

export default function ClientsPage() {
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('');

  const queryParams = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sortBy ? { sort_by: sortBy } : {}),
  };

  const {
    items: clients,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/clients',
    token,
    params: queryParams,
    listKey: 'clients',
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Client Admissions & Roster
          </h1>
          <p className="page-subtitle">
            Active care recipients, Medicaid enrollment records, and service jurisdictions.
          </p>
        </div>

        <Link
          to="/admin/authorizations"
          className="btn-success"
        >
          Issue New Authorization
        </Link>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}

      {/* Filter and Sort Controls */}
      <div className="card p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label htmlFor="client-status-filter" className="sr-only">Filter by Admission Status</label>
            <select
              id="client-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All Admission Statuses</option>
              {Object.entries(CLIENT_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="client-sort-by" className="sr-only">Sort Order</label>
            <select
              id="client-sort-by"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Sort: Registration Date (Newest)</option>
              <option value="service_start_date">Sort: Upcoming Start Date</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-muted">
          Showing {clients.length} of {total} client records
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading client directory...</div>
        ) : clients.length === 0 ? (
          <div className="table-empty-sm">
            No clients found for the selected filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>State</th>
                  <th>Admission Status</th>
                  <th>Service Start Date</th>
                  <th>Medicaid #</th>
                  <th>Phone</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-strong">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="cell-muted">
                      {c.states?.code || 'FL'}
                    </td>
                    <td>
                      <span className={CLIENT_STATUS_BADGE[c.status] || 'badge badge-gray'}>
                        {CLIENT_STATUS_LABELS[c.status] || c.status || 'Pending'}
                      </span>
                    </td>
                    <td className="cell-muted font-medium">
                      {c.service_start_date ? new Date(c.service_start_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-primary font-medium">
                      {c.medicaid_number || 'Pending'}
                    </td>
                    <td className="cell-muted">
                      {c.phone || 'N/A'}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/admin/clients/${c.id}`}
                          className="btn-ghost-download btn-xs"
                        >
                          View / Admit
                        </Link>
                        <Link
                          to={`/admin/authorizations?client_id=${c.id}&client_name=${encodeURIComponent(`${c.first_name} ${c.last_name}`)}&state_id=${c.state_id}`}
                          className="btn-ghost-download btn-xs"
                        >
                          Authorizations
                        </Link>
                      </div>
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
          listLabel="clients"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
