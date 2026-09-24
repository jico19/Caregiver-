import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function DashboardPage() {
  const { token } = useAuth();
  const [selectedState, setSelectedState] = useState('all');
  const [metrics, setMetrics] = useState({
    total_caregivers: 0,
    total_clients: 0,
    pending_applications: 0,
    pending_documents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/admin/dashboard?state=${selectedState}`, token)
      .then((res) => {
        if (!isMounted) return;
        setMetrics(res?.metrics || {});
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg('Failed to load operational metrics.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedState, token]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Agency Administrative Operations
          </h1>
          <p className="page-subtitle">
            Multi-state oversight for Florida, Indiana, and Georgia home care branches.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="state-filter" className="filter-label">
            Jurisdiction:
          </label>
          <select
            id="state-filter"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="select-compact"
          >
            <option value="all">All States (FL, IN, GA)</option>
            <option value="florida">Florida Only</option>
            <option value="indiana">Indiana Only</option>
            <option value="georgia">Georgia Only</option>
          </select>
          {loading && (
            <span className="loading-inline">
              <svg className="spinner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Querying {selectedState === 'all' ? 'all states' : selectedState}...
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Active Caregivers</div>
          <div className="kpi-value">
            {loading ? <div className="skeleton-box skeleton-value" /> : metrics.total_caregivers}
          </div>
          <Link to="/admin/caregivers" className="kpi-link-blue">
            Manage Caregivers →
          </Link>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Registered Clients</div>
          <div className="kpi-value">
            {loading ? <div className="skeleton-box skeleton-value" /> : metrics.total_clients}
          </div>
          <Link to="/admin/clients" className="kpi-link-green">
            View Client Roster →
          </Link>
        </div>

        <div className="kpi-card kpi-card-warning">
          <div className="kpi-label kpi-label-warning">Applications Pending</div>
          <div className="kpi-value kpi-value-warning">
            {loading ? <div className="skeleton-box skeleton-value" /> : metrics.pending_applications}
          </div>
          <Link to="/admin/caregivers" className="kpi-link-warning">
            Review Applications →
          </Link>
        </div>

        <div className="kpi-card kpi-card-info">
          <div className="kpi-label kpi-label-info">Documents for Review</div>
          <div className="kpi-value kpi-value-info">
            {loading ? <div className="skeleton-box skeleton-value" /> : metrics.pending_documents}
          </div>
          <Link to="/admin/documents" className="kpi-link-info">
            Verify Credentials →
          </Link>
        </div>
      </div>

      {/* Operational Workflows */}
      <div className="workflow-grid">
        <div className="workflow-card">
          <h2 className="heading-card mb-2">
            Caregiver Compliance & Onboarding
          </h2>
          <p className="workflow-text">
            Inspect candidate applications, review background checks, and monitor CPR/CNA in-service training compliance.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/caregivers"
              className="btn-link-primary"
            >
              Application Review Queue
            </Link>
            <Link
              to="/admin/documents"
              className="btn-link-secondary"
            >
              Document Queue
            </Link>
          </div>
        </div>

        <div className="workflow-card">
          <h2 className="heading-card mb-2">
            Client Admissions & Authorizations
          </h2>
          <p className="workflow-text">
            Process client intake admissions, issue state Medicaid authorization numbers, and maintain care plans.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/clients"
              className="btn-link-success"
            >
              Client Admissions
            </Link>
            <Link
              to="/admin/authorizations"
              className="btn-link-secondary"
            >
              Issue Authorization
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
