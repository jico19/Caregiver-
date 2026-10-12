import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import Pagination from '../../../shared/components/common/Pagination';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function CaregiversPage() {
  const { token } = useAuth();
  const [viewMode, setViewMode] = useState('pool'); // 'pool' | 'applicants'
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch Staffing Analytics
  const { data: analyticsData } = useFetch('/admin/caregivers/analytics', {
    enabled: !!token,
  });

  const analytics = analyticsData || {
    total_caregivers: 0,
    pending_applications: 0,
    in_onboarding: 0,
    by_state: {},
  };

  const {
    items: applications,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/caregivers',
    token,
    params: statusFilter === 'all' ? {} : { status: statusFilter },
    listKey: 'applications',
  });

  return (
    <PageContainer>
      <PageHeader
        title="Staffing & Caregiver Pool"
        subtitle="Oversight of active caregiver roster, credential compliance, and onboarding applicant review."
        badge={`${analytics.total_caregivers} Active Caregivers`}
        badgeVariant="primary"
        actions={
          <div className="flex items-center gap-2">
            <div className="join">
              <button
                type="button"
                onClick={() => setViewMode('pool')}
                className={`join-item btn btn-xs inline-flex items-center gap-1.5 ${viewMode === 'pool' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Users size={13} /> Active Staff Pool
              </button>
              <button
                type="button"
                onClick={() => setViewMode('applicants')}
                className={`join-item btn btn-xs inline-flex items-center gap-1.5 ${viewMode === 'applicants' ? 'btn-primary' : 'btn-outline'}`}
              >
                <FileText size={13} /> Applicant Queue ({analytics.pending_applications})
              </button>
            </div>
          </div>
        }
      />

      {error && (
        <div role="alert" className="alert alert-error mb-6 text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Staffing KPI Strip */}
      <div className="stats stats-vertical sm:stats-horizontal shadow-xs bg-base-100 border border-base-200 w-full mb-6">
        <div className="stat">
          <div className="stat-title text-xs font-medium">Total Caregivers</div>
          <div className="stat-value text-2xl font-bold">{analytics.total_caregivers}</div>
          <div className="stat-desc">Active pool in roster</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">Pending Reviews</div>
          <div className="stat-value text-2xl font-bold text-warning">{analytics.pending_applications}</div>
          <div className="stat-desc">Awaiting review</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">In Onboarding</div>
          <div className="stat-value text-2xl font-bold text-info">{analytics.in_onboarding}</div>
          <div className="stat-desc">Training & screening</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">Ready for Service</div>
          <div className="stat-value text-2xl font-bold text-success">
            {Math.max(0, analytics.total_caregivers - analytics.pending_applications)}
          </div>
          <div className="stat-desc">Compliance cleared</div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'pool' ? (
        /* Active Caregiver Pool with Credential Compliance Tracking */
        <Card className="p-0 overflow-hidden mb-6">
          <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-3 bg-base-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Caregiver Roster & Compliance Status</h3>
              <p className="text-xs text-slate-500">Live credential status: CPR, CNA, TB test, and state licenses</p>
            </div>
            <Link to="/admin/documents" className="btn btn-xs btn-outline btn-primary inline-flex items-center gap-1">
              Verify Credentials Queue <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading caregiver roster...</div>
          ) : applications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No caregivers found"
                description="No active caregivers currently registered in your jurisdiction."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs bg-base-200/40">
                    <th>Caregiver Name</th>
                    <th>Jurisdiction</th>
                    <th>Contact Phone</th>
                    <th>Compliance Gate</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200 text-sm">
                  {applications.map((app) => {
                    const caregiver = app.caregivers || {};
                    const compliance = app.compliance || { is_compliant: true, blocking_reasons: [] };
                    const isCompliant = compliance.is_compliant !== false;

                    return (
                      <tr key={app.id} className="hover:bg-base-200/30 transition-colors">
                        <td>
                          <div className="font-semibold text-slate-900 text-xs">
                            {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Caregiver'}
                          </div>
                          <div className="text-[11px] text-slate-400">{caregiver.address || 'Address on file'}</div>
                        </td>
                        <td>
                          <span className="badge badge-sm badge-ghost font-medium">
                            {app.states?.code || '—'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600">
                          {caregiver.phone || 'No phone'}
                        </td>
                        <td>
                          {isCompliant ? (
                            <span className="badge badge-xs badge-success text-[11px]">
                              ✓ Cleared for Care
                            </span>
                          ) : (
                            <span
                              className="badge badge-xs badge-error text-[11px]"
                              title={compliance.blocking_reasons?.join(', ')}
                            >
                              ⚠ Action Required
                            </span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={app.status || 'active'} size="xs" />
                        </td>
                        <td className="text-right">
                          <Link
                            to={`/admin/caregivers/${app.id}`}
                            className="btn btn-xs btn-outline btn-primary inline-flex items-center gap-1"
                          >
                            Details <ArrowRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-base-200">
            <Pagination
              page={page}
              pages={pages}
              total={total}
              pageSize={pageSize}
              listLabel="caregivers"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </Card>
      ) : (
        /* Applicant Review Queue */
        <Card className="p-0 overflow-hidden mb-6">
          <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-3 bg-base-100">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-status" className="text-xs font-semibold text-slate-700">
                Filter Stage:
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select select-bordered select-xs text-xs"
              >
                <option value="all">All Applicants</option>
                <option value="submitted">Submitted (Awaiting Review)</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="onboarding">Onboarding</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{applications.length}</strong> applicants
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading applicants...</div>
          ) : applications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No applicants found"
                description="No caregiver applications found for the selected status."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                    <th>Applicant Name</th>
                    <th>Jurisdiction</th>
                    <th>Phone</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th className="text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const caregiver = app.caregivers || {};

                    return (
                      <tr key={app.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                        <td className="font-semibold text-slate-900 text-xs">
                          {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Applicant'}
                        </td>
                        <td className="text-slate-600 text-xs">
                          {app.states?.code || 'FL'}
                        </td>
                        <td className="text-slate-600 text-xs">{caregiver.phone || '—'}</td>
                        <td className="text-slate-500 text-xs">
                          {app.submitted_at || app.created_at
                            ? new Date(app.submitted_at || app.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>
                          <StatusBadge status={app.status} size="xs" />
                        </td>
                        <td className="text-right">
                          <Link
                            to={`/admin/caregivers/${app.id}`}
                            className="btn btn-xs btn-primary font-semibold inline-flex items-center gap-1"
                          >
                            Review <ArrowRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-base-200">
            <Pagination
              page={page}
              pages={pages}
              total={total}
              pageSize={pageSize}
              listLabel="applications"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </Card>
      )}

      {/* Staff by Branch Breakdown Cards (SharePoint pics/2.jpeg layout) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-base-100 border border-base-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Florida Branch (FL)</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {analytics.by_state?.['1'] || analytics.by_state?.[1] || 0} Staff
            </div>
          </div>
          <span className="badge badge-sm badge-ghost">Active</span>
        </Card>

        <Card className="p-4 bg-base-100 border border-base-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Indiana Branch (IN)</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {analytics.by_state?.['2'] || analytics.by_state?.[2] || 0} Staff
            </div>
          </div>
          <span className="badge badge-sm badge-ghost">Active</span>
        </Card>

        <Card className="p-4 bg-base-100 border border-base-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Georgia Branch (GA)</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {analytics.by_state?.['3'] || analytics.by_state?.[3] || 0} Staff
            </div>
          </div>
          <span className="badge badge-sm badge-ghost">Active</span>
        </Card>
      </div>
    </PageContainer>
  );
}
