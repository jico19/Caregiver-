import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import Pagination from '../../../shared/components/common/Pagination';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';
import { CLIENT_STATUS_LABELS } from '../../../shared/constants/clientStatus';

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
    <PageContainer>
      <PageHeader
        title="Client Admissions & Roster"
        subtitle="Active care recipients, Medicaid enrollment records, and service jurisdictions."
        actions={
          <Link
            to="/admin/authorizations"
            className="btn btn-primary btn-sm"
          >
            Issue New Authorization
          </Link>
        }
      />

      {error && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Sort Controls */}
      <Card className="p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
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
              className="select select-bordered select-xs text-xs"
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
              className="select select-bordered select-xs text-xs"
            >
              <option value="">Sort: Registration Date (Newest)</option>
              <option value="service_start_date">Sort: Upcoming Start Date</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing {clients.length} of {total} client records
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading client directory...</div>
        ) : clients.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No clients found"
              description="No clients found for the selected filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
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
                  <tr key={c.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                    <td className="font-semibold text-slate-900 text-xs">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {c.states?.code || 'FL'}
                    </td>
                    <td>
                      <StatusBadge
                        status={c.status}
                        label={CLIENT_STATUS_LABELS[c.status] || c.status || 'Pending'}
                      />
                    </td>
                    <td className="text-slate-600 text-xs">
                      {c.service_start_date ? new Date(c.service_start_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="font-mono text-xs text-emerald-800">
                      {c.medicaid_number || 'Pending'}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {c.phone || 'N/A'}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={`/admin/clients/${c.id}`}
                          className="btn btn-outline btn-xs"
                        >
                          View / Admit
                        </Link>
                        <Link
                          to={`/admin/authorizations?client_id=${c.id}&client_name=${encodeURIComponent(`${c.first_name} ${c.last_name}`)}&state_id=${c.state_id}`}
                          className="btn btn-ghost btn-xs text-slate-600 hover:text-slate-900"
                        >
                          Auths
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-base-300">
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
      </Card>
    </PageContainer>
  );
}
