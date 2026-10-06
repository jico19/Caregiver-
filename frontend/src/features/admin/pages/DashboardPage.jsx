import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';

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
    <PageContainer>
      <PageHeader
        title="Agency Administrative Operations"
        subtitle="Multi-state oversight for Florida, Indiana, and Georgia home care branches."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="state-filter" className="text-xs font-semibold text-slate-700">
              Jurisdiction:
            </label>
            <select
              id="state-filter"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="select select-bordered select-xs text-xs"
            >
              <option value="all">All States (FL, IN, GA)</option>
              <option value="florida">Florida Only</option>
              <option value="indiana">Indiana Only</option>
              <option value="georgia">Georgia Only</option>
            </select>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                <span className="loading loading-spinner loading-xs text-emerald-600" />
                Querying...
              </span>
            )}
          </div>
        }
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Active Caregivers</div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.total_caregivers}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-base-300">
            <Link to="/admin/caregivers" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Manage Caregivers →
            </Link>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Registered Clients</div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.total_clients}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-base-300">
            <Link to="/admin/clients" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              View Client Roster →
            </Link>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between bg-amber-50/20 border-amber-200">
          <div>
            <div className="text-xs text-amber-800 font-medium uppercase tracking-wider mb-1">Applications Pending</div>
            <div className="text-2xl font-bold text-amber-900">
              {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.pending_applications}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-200">
            <Link to="/admin/caregivers" className="text-xs font-semibold text-amber-800 hover:text-amber-900">
              Review Applications →
            </Link>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between bg-base-200/40">
          <div>
            <div className="text-xs text-slate-600 font-medium uppercase tracking-wider mb-1">Documents for Review</div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? <span className="skeleton w-16 h-8 inline-block" /> : metrics.pending_documents}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-base-300">
            <Link to="/admin/documents" className="text-xs font-semibold text-slate-700 hover:text-slate-900">
              Verify Credentials →
            </Link>
          </div>
        </Card>
      </div>

      {/* Operational Workflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-base text-slate-900 mb-1">
            Caregiver Compliance & Onboarding
          </h2>
          <p className="text-slate-600 text-xs mb-5 leading-normal">
            Inspect candidate applications, review background checks, and monitor CPR/CNA in-service training compliance.
          </p>
          <div className="flex flex-wrap gap-2">
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
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-base text-slate-900 mb-1">
            Client Admissions & Authorizations
          </h2>
          <p className="text-slate-600 text-xs mb-5 leading-normal">
            Process client intake admissions, issue state Medicaid authorization numbers, and maintain care plans.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/clients"
              className="btn btn-primary btn-sm"
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
        </Card>
      </div>
    </PageContainer>
  );
}
