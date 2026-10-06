import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import ConfirmModal from '../../../shared/components/common/ConfirmModal';
import EmptyState from '../../../shared/components/common/EmptyState';
import Pagination from '../../../shared/components/common/Pagination';

export default function UsersPage() {
  const { user, token } = useAuth();
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const [offboardTarget, setOffboardTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const {
    items: users,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    reload,
  } = usePaginatedFetch({
    url: '/admin/users',
    token,
    params: {
      role: roleFilter,
      status: statusFilter,
      state_id: stateFilter,
    },
    listKey: 'users',
  });

  async function handleToggleStatus(u) {
    setActionError('');
    setActionSuccess('');
    setBusy(true);

    const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api.post(`/admin/users/${u.id}/status`, { status: newStatus }, token);
      setActionSuccess(`User ${u.email} status updated to ${newStatus}.`);
      reload();
    } catch (err) {
      setActionError(err.detail || err.message || 'Failed to update user status.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOffboardConfirm() {
    if (!offboardTarget) return;
    setActionError('');
    setActionSuccess('');
    setBusy(true);

    try {
      await api.delete(`/admin/users/${offboardTarget.id}`, token);
      setActionSuccess(`User ${offboardTarget.email} was successfully offboarded.`);
      setOffboardTarget(null);
      reload();
    } catch (err) {
      setActionError(err.detail || err.message || 'Failed to offboard user.');
    } finally {
      setBusy(false);
    }
  }

  const displayUsers = users.filter((u) => (u.roles?.name || u.role) !== 'super_admin');

  return (
    <PageContainer>
      <PageHeader
        title="User Access & Lifecycle Management"
        description="Manage platform users, update access status, and process soft-delete offboarding."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="filter-role"
              aria-label="Filter role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="select select-bordered select-sm text-sm"
            >
              <option value="all">All Roles</option>
              <option value="caregiver">Caregiver</option>
              <option value="client">Client</option>
              <option value="administrator">Administrator</option>
            </select>

            <select
              id="filter-status"
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select select-bordered select-sm text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>

            {isSuperAdmin && (
              <select
                id="filter-state"
                aria-label="Filter state"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="select select-bordered select-sm text-sm"
              >
                <option value="all">All States</option>
                <option value="1">Florida</option>
                <option value="2">Indiana</option>
                <option value="3">Georgia</option>
              </select>
            )}
          </div>
        }
      />

      {actionError && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div role="status" className="alert alert-success mb-4 text-sm py-2 px-4 rounded-box">
          {actionSuccess}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading user accounts...</div>
        ) : displayUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            message="No users match the selected role, status, or state criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>User Email</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {displayUsers.map((u) => {
                  const roleName = u.roles?.name || u.role || 'user';
                  const stateName = u.states?.name || (u.state_id ? `State #${u.state_id}` : 'All States');
                  const isSelf = u.id === user?.sub || u.id === user?.id;

                  return (
                    <tr key={u.id} className="hover:bg-base-200/40 transition-colors">
                      <td className="font-medium text-slate-900">
                        {u.email}
                        {isSelf && <span className="ml-2 badge badge-xs badge-neutral badge-soft">You</span>}
                      </td>
                      <td className="capitalize text-slate-600">{roleName.replace('_', ' ')}</td>
                      <td className="text-slate-500">{stateName}</td>
                      <td>
                        <StatusBadge status={u.status} label={u.status} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() => handleToggleStatus(u)}
                            className="btn btn-ghost btn-xs border border-base-300 font-normal"
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>

                          {isSuperAdmin && (
                            <button
                              type="button"
                              disabled={busy || isSelf}
                              onClick={() => setOffboardTarget(u)}
                              className="btn btn-ghost btn-xs border border-error/30 text-error hover:bg-error/10 font-normal"
                            >
                              Offboard
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="p-4 border-t border-base-200">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              pages={pages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={!!offboardTarget}
        title="Offboard User Account"
        message={
          offboardTarget
            ? `Are you sure you want to offboard ${offboardTarget.email}? Soft-delete notice: offboarding revokes platform access and sets user status to inactive. Regulatory records and documents are preserved.`
            : ''
        }
        confirmText="Confirm Offboard"
        confirmVariant="error"
        loading={busy}
        onConfirm={handleOffboardConfirm}
        onClose={() => setOffboardTarget(null)}
      />
    </PageContainer>
  );
}
