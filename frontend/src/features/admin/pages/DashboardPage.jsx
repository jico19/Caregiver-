import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';

export default function DashboardPage() {
  const { token } = useAuth();
  const [selectedState, setSelectedState] = useState('all');

  const { data, isLoading, error } = useFetch('/admin/dashboard', {
    params: { state: selectedState },
    enabled: !!token,
  });

  const metrics = data?.metrics || {
    total_caregivers: 0,
    total_clients: 0,
    pending_applications: 0,
    pending_documents: 0,
  };
  const errorMsg = error ? 'Failed to load operational metrics.' : '';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content mb-1">
            Agency Administrative Operations
          </h1>
          <p className="text-secondary text-sm">
            Multi-state oversight for Florida, Indiana, and Georgia home care branches.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="state-filter" className="text-sm font-medium text-base-content">
            Jurisdiction:
          </label>
          <select
            id="state-filter"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="all">All States (FL, IN, GA)</option>
            <option value="florida">Florida Only</option>
            <option value="indiana">Indiana Only</option>
            <option value="georgia">Georgia Only</option>
          </select>
          {isLoading && (
            <span className="inline-flex items-center gap-2 text-xs text-primary">
              <span className="loading loading-spinner loading-xs text-primary" />
              Querying {selectedState === 'all' ? 'all states' : selectedState}...
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-6">
          {errorMsg}
        </div>
      )}

      {/* KPI Stats */}
      <div className="stats stats-vertical md:stats-horizontal shadow-sm border border-base-200 w-full mb-8 bg-base-100">
        <div className="stat">
          <div className="stat-title text-xs font-semibold uppercase">Active Caregivers</div>
          <div className="stat-value text-primary">
            {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.total_caregivers}
          </div>
          <div className="stat-actions">
            <Link to="/admin/caregivers" className="text-xs text-primary font-medium hover:underline">
              Manage Caregivers →
            </Link>
          </div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-semibold uppercase">Registered Clients</div>
          <div className="stat-value text-success">
            {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.total_clients}
          </div>
          <div className="stat-actions">
            <Link to="/admin/clients" className="text-xs text-success font-medium hover:underline">
              View Client Roster →
            </Link>
          </div>
        </div>

        <div className="stat bg-warning/5">
          <div className="stat-title text-xs font-semibold uppercase text-warning">Applications Pending</div>
          <div className="stat-value text-warning">
            {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.pending_applications}
          </div>
          <div className="stat-actions">
            <Link to="/admin/caregivers" className="text-xs text-warning font-medium hover:underline">
              Review Applications →
            </Link>
          </div>
        </div>

        <div className="stat bg-info/5">
          <div className="stat-title text-xs font-semibold uppercase text-info">Documents for Review</div>
          <div className="stat-value text-info">
            {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.pending_documents}
          </div>
          <div className="stat-actions">
            <Link to="/admin/documents" className="text-xs text-info font-medium hover:underline">
              Verify Credentials →
            </Link>
          </div>
        </div>
      </div>

      {/* Operational Workflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-base-content mb-2">
            Caregiver Compliance & Onboarding
          </h2>
          <p className="text-secondary text-sm mb-5 leading-relaxed">
            Inspect candidate applications, review background checks, and monitor CPR/CNA in-service training compliance.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/caregivers"
              className="btn btn-primary btn-sm"
            >
              Application Review Queue
            </Link>
            <Link
              to="/admin/documents"
              className="btn btn-outline btn-sm"
            >
              Document Queue
            </Link>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-base-content mb-2">
            Client Admissions & Authorizations
          </h2>
          <p className="text-secondary text-sm mb-5 leading-relaxed">
            Process client intake admissions, issue state Medicaid authorization numbers, and maintain care plans.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/clients"
              className="btn btn-success text-white btn-sm"
            >
              Client Admissions
            </Link>
            <Link
              to="/admin/authorizations"
              className="btn btn-outline btn-sm"
            >
              Issue Authorization
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
