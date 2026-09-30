import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import usePaginatedFetch from '../../hooks/usePaginatedFetch';
import Pagination from '../../components/common/Pagination';

function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'badge badge-green';
    case 'suspended':
      return 'badge badge-yellow';
    case 'inactive':
      return 'badge badge-red';
    default:
      return 'badge badge-gray';
  }
}

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
    <div className="page-container">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">User Access & Lifecycle Management</h1>
          <p className="page-subtitle">
            Manage platform users, update access status, and process soft-delete offboarding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <label htmlFor="filter-role" className="filter-label">
              Role:
            </label>
            <select
              id="filter-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="select-compact"
            >
              <option value="all">All Roles</option>
              <option value="caregiver">Caregiver</option>
              <option value="client">Client</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
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
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {isSuperAdmin && (
            <div className="flex items-center gap-1">
              <label htmlFor="filter-state" className="filter-label">
                State:
              </label>
              <select
                id="filter-state"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="select-compact"
              >
                <option value="all">All States</option>
                <option value="1">Florida</option>
                <option value="2">Indiana</option>
                <option value="3">Georgia</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="alert alert-error mb-4">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div role="status" className="alert alert-success mb-4">
          {actionSuccess}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          {error}
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading user accounts...</div>
        ) : displayUsers.length === 0 ? (
          <div className="table-empty-sm">
            No users found matching the selected criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u) => {
                  const roleName = u.roles?.name || u.role || 'user';
                  const stateName = u.states?.name || (u.state_id ? `State #${u.state_id}` : 'All States');
                  const isSelf = u.id === user?.sub || u.id === user?.id;

                  return (
                    <tr key={u.id}>
                      <td className="cell-strong">
                        {u.email}
                        {isSelf && <span className="ml-2 text-xs text-blue-600 font-semibold">(You)</span>}
                      </td>
                      <td className="capitalize">{roleName.replace('_', ' ')}</td>
                      <td className="cell-muted">{stateName}</td>
                      <td>
                        <span className={statusBadgeClass(u.status)}>
                          {u.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() => handleToggleStatus(u)}
                            className="btn btn-sm btn-outline"
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>

                          {isSuperAdmin && (
                            <button
                              type="button"
                              disabled={busy || isSelf}
                              onClick={() => setOffboardTarget(u)}
                              className="btn btn-sm btn-danger-outline"
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
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            pages={pages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {offboardTarget && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="text-lg font-bold mb-2">Offboard User Account</h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to offboard <strong>{offboardTarget.email}</strong>?
            </p>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded mb-4">
              <strong>Soft-Delete Notice:</strong> Offboarding revokes platform access and sets user status to inactive. Clinical records, care plans, schedules, and uploaded compliance documents are soft-deleted and preserved for regulatory compliance. The authentication account is not hard-deleted.
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={busy}
                onClick={() => setOffboardTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={handleOffboardConfirm}
              >
                Confirm Offboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
