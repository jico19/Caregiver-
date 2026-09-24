import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function ClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    api.get('/admin/clients', token)
      .then((res) => {
        if (!isMounted) return;
        setClients(res?.clients || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg('Failed to load client roster.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

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

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
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
                      <Link
                        to={`/admin/authorizations?client_id=${c.id}&client_name=${encodeURIComponent(`${c.first_name} ${c.last_name}`)}&state_id=${c.state_id}`}
                        className="btn-ghost-download btn-xs"
                      >
                        Authorizations
                      </Link>
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
