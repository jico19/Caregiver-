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
import { STATUS_META } from '../../../shared/utils/caregiverStatus';

export default function CaregiversPage() {
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
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
        title="Caregiver Onboarding & Applications"
        subtitle="Review candidate qualifications, assign state offices, and process compliance approvals."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="text-xs font-semibold text-slate-700">
              Status:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select select-bordered select-xs text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="onboarding">Onboarding</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        }
      />

      {error && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading applicants...</div>
        ) : applications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No applications found"
              description="No caregiver applications found for the selected status."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
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
                    <tr key={app.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                      <td className="font-semibold text-slate-900 text-xs">
                        {caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Applicant'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {app.states?.code || 'FL'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {caregiver.phone || 'N/A'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {new Date(app.submitted_at || app.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <StatusBadge
                          status={app.status}
                          label={STATUS_META[app.status]?.label || app.status.replace('_', ' ')}
                        />
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/admin/caregivers/${app.id}`}
                          className="btn btn-outline btn-xs text-emerald-700 hover:text-emerald-800"
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

        <div className="p-3 border-t border-base-300">
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
    </PageContainer>
  );
}
