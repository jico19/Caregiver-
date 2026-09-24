import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function AuthorizationsPage() {
  const { token } = useAuth();
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAuthorizations() {
      try {
        const res = await api.get('/clients/me/authorizations', token);
        if (!isMounted) return;
        setAuthorizations(res?.authorizations || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load authorization records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadAuthorizations();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return <div className="loading-text">Loading service authorizations...</div>;
  }

  const statusBadge = {
    active: 'badge-green',
    expiring_soon: 'badge-yellow',
    pending: 'badge-blue',
    expired: 'badge-red',
    rejected: 'badge-gray',
  };

  const statusLabel = {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    pending: 'Pending Review',
    expired: 'Expired',
    rejected: 'Rejected',
  };

  return (
    <div className="container-wide">
      <div className="page-head">
        <h1 className="page-title">
          Medicaid & Insurance Authorizations
        </h1>
        <p className="page-subtitle">
          Official state authorizations governing covered hours, service periods, and home care provisions.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title m-0">
            Authorization Records ({authorizations.length})
          </h2>
          <span className="text-xs text-muted">
            Managed by State Medicaid Office
          </span>
        </div>

        {authorizations.length === 0 ? (
          <div className="card-empty">
            <h3 className="section-title mb-2">
              No Active Authorizations on File
            </h3>
            <p className="text-sm max-w-lg mx-auto mb-6 leading-normal">
              Authorizations are generated once your intake details, physician orders, and Medicaid eligibility have been reviewed by your state coordinator.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/client/intake"
                className="btn-success"
              >
                Complete Intake Details
              </Link>
              <Link
                to="/client/documents"
                className="btn-outline-secondary"
              >
                Upload Medical Orders
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Authorization #</th>
                  <th>State</th>
                  <th>Effective Window</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {authorizations.map((auth) => {
                  const isExpiringSoon = auth.days_until_expiration !== null && auth.days_until_expiration <= 30;
                  const badge = statusBadge[auth.status] || statusBadge.pending;
                  const label = statusLabel[auth.status] || statusLabel.pending;
                  return (
                    <tr key={auth.id}>
                      <td className="font-semibold">
                        {auth.authorization_number}
                      </td>
                      <td className="text-secondary">
                        {auth.states?.code || 'State'}
                      </td>
                      <td className="text-secondary">
                        {auth.start_date} to {auth.end_date}
                      </td>
                      <td className={isExpiringSoon ? 'text-[#b45309] font-semibold' : 'text-secondary'}>
                        {auth.days_until_expiration !== null ? `${auth.days_until_expiration} days` : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="text-muted text-xs">
                        {auth.notes || 'Routine authorized services'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}