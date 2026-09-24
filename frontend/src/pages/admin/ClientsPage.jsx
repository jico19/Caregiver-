import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePaginatedFetch from '../../hooks/usePaginatedFetch';
import Pagination from '../../components/common/Pagination';

export default function ClientsPage() {
  const { token } = useAuth();
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

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading client directory...</div>
        ) : clients.length === 0 ? (
          <div className="table-empty-sm">
            No clients registered yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>State</th>
                  <th>Medicaid #</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Registered</th>
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
                    <td className="text-primary font-medium">
                      {c.medicaid_number || 'Pending'}
                    </td>
                    <td className="cell-muted">
                      {c.phone || 'N/A'}
                    </td>
                    <td className="cell-muted text-xs">
                      {c.address || 'N/A'}
                    </td>
                    <td className="cell-muted">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/admin/clients/${c.id}`}
                          className="btn-ghost-download btn-xs"
                        >
                          View
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
