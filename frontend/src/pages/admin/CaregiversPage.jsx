import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { STATUS_META } from '../../utils/caregiverStatus';

function badgeClass(status) {
  const meta = STATUS_META[status];
  return meta ? `badge ${meta.badge}` : 'badge badge-gray';
}

export default function CaregiversPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const url = statusFilter === 'all' ? '/admin/caregivers' : `/admin/caregivers?status=${statusFilter}`;
    api.get(url, token)
      .then((res) => {
        if (!isMounted) return;
        setApplications(res?.applications || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg('Failed to load caregiver application queue.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [statusFilter, token]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Caregiver Onboarding & Applications
          </h1>
          <p className="page-subtitle">
            Review candidate qualifications, assign state offices, and process compliance approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="filter-label">
            Status:
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-compact"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="onboarding">Onboarding</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading applicants...</div>
        ) : applications.length === 0 ? (
          <div className="table-empty-sm">
            No caregiver applications found for the selected status.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Applicant Name</th>
                  <th>State</th>
                  <th>Phone</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                  <th className="text-right">Review Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const caregiver = app.caregivers || {};

                  return (
                    <tr key={app.id}>
                      <td className="cell-strong">
                        {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Applicant'}
                      </td>
                      <td className="cell-muted">
                        {app.states?.code || 'FL'}
                      </td>
                      <td className="cell-muted">
                        {caregiver.phone || 'N/A'}
                      </td>
                      <td className="cell-muted">
                        {new Date(app.submitted_at || app.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={badgeClass(app.status)}>
                          {STATUS_META[app.status]?.label || app.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/admin/caregivers/${app.id}`}
                          className="btn-approve text-sm font-semibold"
                        >
                          Review →
                        </Link>
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
