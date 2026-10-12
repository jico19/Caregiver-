import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Kanban, Table2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import useFetch from '../../../shared/hooks/useFetch';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import ConfirmModal from '../../../shared/components/common/ConfirmModal';
import Pagination from '../../../shared/components/common/Pagination';

const STATUS_LABELS = {
  new: 'New Referral',
  contacted: 'In Progress / Contacted',
  converted: 'Converted to Client',
  closed: 'Not Qualified / Closed',
};

export default function ReferralsPage() {
  const { token } = useAuth();
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'table'
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [convertedClientId, setConvertedClientId] = useState(null);

  // Confirmation Modal State for Conversion
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Fetch states list dynamically
  const { data: statesData } = useFetch('/states', { defaultData: [] });
  const states = Array.isArray(statesData) ? statesData : statesData?.states || [];

  // Fetch Intake Analytics
  const { data: analyticsData, reload: reloadAnalytics } = useFetch('/admin/referrals/analytics', {
    params: {
      ...(filterState !== 'all' ? { state_id: filterState } : {}),
    },
    enabled: !!token,
  });

  const analytics = analyticsData || {
    total_referrals: 0,
    by_status: { new: 0, contacted: 0, converted: 0, closed: 0 },
    by_source: [],
    conversion_rate_pct: 0,
  };

  const params = {
    status: filterStatus === 'all' ? '' : filterStatus,
    state_id: filterState === 'all' ? '' : filterState,
    ...(filterUnassigned ? { unassigned: 'true' } : {}),
  };

  const {
    items: referrals,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    reload: reloadTable,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/referrals',
    token,
    params,
    listKey: 'referrals',
  });

  function reloadAll() {
    reloadTable();
    reloadAnalytics();
  }

  function handleResetFilters() {
    setFilterStatus('all');
    setFilterState('all');
    setFilterUnassigned(false);
    setErrorMsg('');
    setSuccessMsg('');
    setConvertedClientId(null);
  }

  async function executeStatusChange(referral, targetStatus) {
    setUpdatingId(referral.id);
    setErrorMsg('');
    setSuccessMsg('');
    setConvertedClientId(null);
    try {
      const res = await api.patch(`/admin/referrals/${referral.id}`, { status: targetStatus }, token);
      if (targetStatus === 'converted' && res?.client_id) {
        setConvertedClientId(res.client_id);
        setSuccessMsg(`Referral for ${referral.first_name} ${referral.last_name} converted to client profile.`);
      } else {
        setSuccessMsg(`Referral marked as "${STATUS_LABELS[targetStatus] || targetStatus}".`);
      }
      reloadAll();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update referral status.');
    } finally {
      setUpdatingId(null);
      setConfirmTarget(null);
    }
  }

  function handleStatusSelect(referral, targetStatus) {
    if (targetStatus === 'converted') {
      setConfirmTarget(referral);
    } else {
      executeStatusChange(referral, targetStatus);
    }
  }

  async function handleUpdateNotes(referralId, notes) {
    try {
      await api.patch(`/admin/referrals/${referralId}`, { handled_notes: notes }, token);
      reloadAll();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to save notes.');
    }
  }

  const hasActiveFilters = filterStatus !== 'all' || filterState !== 'all' || filterUnassigned;

  // Filtered referrals grouped into pipeline columns
  const pipelineNew = referrals.filter((r) => r.status === 'new');
  const pipelineContacted = referrals.filter((r) => r.status === 'contacted');
  const pipelineConverted = referrals.filter((r) => r.status === 'converted');
  const pipelineClosed = referrals.filter((r) => r.status === 'closed');

  return (
    <PageContainer>
      <PageHeader
        title="Client Intake Dashboard"
        subtitle="Manage care inquiries, admission pipelines, and referral conversions across all jurisdictions."
        badge={`${analytics.total_referrals} Total Inquiries`}
        badgeVariant="primary"
        actions={
          <div className="flex items-center gap-2">
            <div className="join">
              <button
                type="button"
                onClick={() => setViewMode('pipeline')}
                className={`join-item btn btn-xs inline-flex items-center gap-1.5 ${viewMode === 'pipeline' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Kanban size={13} /> Pipeline View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`join-item btn btn-xs inline-flex items-center gap-1.5 ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Table2 size={13} /> Table Roster
              </button>
            </div>
          </div>
        }
      />

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" className="alert alert-success mb-4 flex items-center justify-between text-sm py-2 px-4 rounded-box">
          <span>{successMsg}</span>
          {convertedClientId && (
            <Link to={`/admin/clients/${convertedClientId}`} className="link link-hover font-semibold ml-3 inline-flex items-center gap-1">
              View Client Profile & Admit <ArrowRight size={12} />
            </Link>
          )}
        </div>
      )}

      {/* Confirmation Modal for Conversion */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        title="Confirm Client Conversion"
        message={
          confirmTarget
            ? `Converting ${confirmTarget.first_name} ${confirmTarget.last_name} will automatically create a pending Client Profile and user portal account using their email (${confirmTarget.email || 'N/A'}).`
            : ''
        }
        confirmText="Convert to Client"
        confirmVariant="primary"
        loading={updatingId === confirmTarget?.id}
        onConfirm={() => executeStatusChange(confirmTarget, 'converted')}
        onClose={() => setConfirmTarget(null)}
      />

      {/* Intake KPI Strip */}
      <div className="stats stats-vertical sm:stats-horizontal shadow-xs bg-base-100 border border-base-200 w-full mb-6">
        <div className="stat">
          <div className="stat-title text-xs font-medium">Total Inquiries</div>
          <div className="stat-value text-2xl font-bold">{analytics.total_referrals}</div>
          <div className="stat-desc">All received leads</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">New Inquiries</div>
          <div className="stat-value text-2xl font-bold text-warning">{analytics.by_status?.new || 0}</div>
          <div className="stat-desc">Awaiting contact</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">In Evaluation</div>
          <div className="stat-value text-2xl font-bold text-info">{analytics.by_status?.contacted || 0}</div>
          <div className="stat-desc">Intake underway</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">Converted Clients</div>
          <div className="stat-value text-2xl font-bold text-success">{analytics.by_status?.converted || 0}</div>
          <div className="stat-desc">Admitted to service</div>
        </div>

        <div className="stat">
          <div className="stat-title text-xs font-medium">Conversion Rate</div>
          <div className="stat-value text-2xl font-bold">{analytics.conversion_rate_pct}%</div>
          <div className="stat-desc">Lead to admission</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="p-3 mb-6 bg-base-100 border border-base-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select select-bordered select-xs text-xs"
          >
            <option value="all">All Pipeline Stages</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            aria-label="Filter by state"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="select select-bordered select-xs text-xs"
          >
            <option value="all">All Jurisdictions</option>
            {states.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.code})
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer border border-base-300 rounded px-2 py-1 bg-base-100 hover:bg-base-200/50">
            <input
              type="checkbox"
              checked={filterUnassigned}
              onChange={(e) => setFilterUnassigned(e.target.checked)}
              className="checkbox checkbox-primary checkbox-xs"
            />
            Unassigned Only
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-ghost btn-xs text-slate-600 hover:text-slate-900"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{referrals.length}</strong> of <strong className="text-slate-900">{total}</strong> leads
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'pipeline' ? (
        /* Visual Kanban Pipeline (SharePoint pics/3.jpeg layout) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Column 1: New Referrals */}
          <div className="bg-base-200/50 rounded-xl p-3 border border-base-200 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-base-300">
              <span className="font-bold text-xs text-amber-800 uppercase tracking-wide">
                1. New Referral ({pipelineNew.length})
              </span>
              <span className="badge badge-xs badge-warning" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
              {pipelineNew.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No new referrals</div>
              ) : (
                pipelineNew.map((r) => (
                  <div key={r.id} className="p-3 bg-base-100 rounded-lg border border-base-200 shadow-xs hover:border-amber-400 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{r.first_name} {r.last_name}</span>
                      <span className="badge badge-xs badge-ghost font-semibold">{r.states?.code || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      {r.referral_source || 'Website'} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                    </div>
                    {r.notes && <p className="text-xs text-slate-600 line-clamp-2 mb-2 italic">"{r.notes}"</p>}
                    <div className="pt-2 border-t border-base-200 flex items-center justify-between">
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() => executeStatusChange(r, 'contacted')}
                        className="btn btn-xs btn-primary btn-outline inline-flex items-center gap-1"
                      >
                        Start Intake <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: In Progress / Contacted */}
          <div className="bg-base-200/50 rounded-xl p-3 border border-base-200 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-base-300">
              <span className="font-bold text-xs text-indigo-800 uppercase tracking-wide">
                2. In Progress ({pipelineContacted.length})
              </span>
              <span className="badge badge-xs badge-info" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
              {pipelineContacted.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No active intakes</div>
              ) : (
                pipelineContacted.map((r) => (
                  <div key={r.id} className="p-3 bg-base-100 rounded-lg border border-base-200 shadow-xs hover:border-indigo-400 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{r.first_name} {r.last_name}</span>
                      <span className="badge badge-xs badge-ghost font-semibold">{r.states?.code || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      {r.phone || r.email || 'No contact'}
                    </div>
                    {r.handled_notes && (
                      <div className="text-xs text-indigo-900 bg-indigo-50/50 p-1.5 rounded mb-2">
                        {r.handled_notes}
                      </div>
                    )}
                    <div className="pt-2 border-t border-base-200 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() => handleStatusSelect(r, 'converted')}
                        className="btn btn-xs btn-success text-white"
                      >
                        Convert Client
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() => executeStatusChange(r, 'closed')}
                        className="btn btn-xs btn-ghost text-slate-400 hover:text-error"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Converted Clients */}
          <div className="bg-base-200/50 rounded-xl p-3 border border-base-200 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-base-300">
              <span className="font-bold text-xs text-emerald-800 uppercase tracking-wide">
                3. Converted ({pipelineConverted.length})
              </span>
              <span className="badge badge-xs badge-success" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
              {pipelineConverted.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No converted clients yet</div>
              ) : (
                pipelineConverted.map((r) => (
                  <div key={r.id} className="p-3 bg-base-100 rounded-lg border border-emerald-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{r.first_name} {r.last_name}</span>
                      <span className="badge badge-xs badge-success">Admitted</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">{r.email || r.phone}</div>
                    {r.converted_client_id && (
                      <Link
                        to={`/admin/clients/${r.converted_client_id}`}
                        className="btn btn-xs btn-block btn-outline btn-primary mt-1 inline-flex items-center justify-center gap-1"
                      >
                        View Client Profile <ArrowRight size={11} />
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 4: Closed / Not Qualified */}
          <div className="bg-base-200/50 rounded-xl p-3 border border-base-200 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-base-300">
              <span className="font-bold text-xs text-slate-600 uppercase tracking-wide">
                4. Closed ({pipelineClosed.length})
              </span>
              <span className="badge badge-xs badge-neutral" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
              {pipelineClosed.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No closed inquiries</div>
              ) : (
                pipelineClosed.map((r) => (
                  <div key={r.id} className="p-3 bg-base-100 rounded-lg border border-base-200 opacity-75">
                    <div className="font-bold text-xs text-slate-800">{r.first_name} {r.last_name}</div>
                    <div className="text-[11px] text-slate-400">{r.referral_source || 'Inquiry'}</div>
                    <div className="pt-2 border-t border-base-200 mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => executeStatusChange(r, 'new')}
                        className="btn btn-xs btn-ghost text-primary text-[11px]"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tabular Roster View */
        <Card className="overflow-hidden mb-8">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Loading referrals...</div>
          ) : referrals.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {total === 0
                ? 'No referrals yet. New inquiries from the public contact forms will appear here.'
                : 'No referrals match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                    <th>Lead</th>
                    <th>State</th>
                    <th>Source</th>
                    <th>Inquiry Notes</th>
                    <th>Handling Remarks</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200 text-sm">
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-base-200/40 transition-colors">
                      <td>
                        <div className="font-medium text-slate-900">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.phone || 'No phone'}
                          {r.email && ` · ${r.email}`}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-sm badge-ghost font-medium">
                          {r.states?.code || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-sm badge-neutral badge-soft">
                          {r.referral_source || 'Website Inquiry'}
                        </span>
                      </td>
                      <td className="max-w-xs text-xs">
                        {r.notes ? (
                          <div className="truncate text-slate-600" title={r.notes}>{r.notes}</div>
                        ) : (
                          <span className="text-slate-400 italic">No notes</span>
                        )}
                      </td>
                      <td className="max-w-xs text-xs">
                        <div
                          onClick={() => {
                            const val = window.prompt('Enter handling remarks / office notes:', r.handled_notes || '');
                            if (val !== null && val !== r.handled_notes) handleUpdateNotes(r.id, val);
                          }}
                          className="cursor-pointer hover:bg-base-200/70 rounded p-1"
                          title="Click to edit handling remarks"
                        >
                          {r.handled_notes ? (
                            <div className="text-xs text-slate-700">{r.handled_notes}</div>
                          ) : (
                            <span className="text-slate-400 italic text-xs hover:text-primary">+ Add remarks</span>
                          )}
                        </div>
                      </td>

                      <td className="text-slate-500 whitespace-nowrap text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        <StatusBadge status={r.status} label={STATUS_LABELS[r.status] || r.status} />
                        {r.converted_client_id && (
                          <div className="mt-1">
                            <Link to={`/admin/clients/${r.converted_client_id}`} className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                              View Client <ArrowRight size={11} />
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <select
                          aria-label={`Update status for ${r.first_name} ${r.last_name}`}
                          value={r.status}
                          disabled={updatingId === r.id || r.status === 'converted'}
                          onChange={(e) => handleStatusSelect(r, e.target.value)}
                          className="select select-bordered select-xs"
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val} disabled={val === 'converted' && r.converted_client_id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
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
              listLabel="referrals"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </Card>
      )}

      {/* Referrals by Source Breakdown (from pics/3.jpeg) */}
      {analytics.by_source && analytics.by_source.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-sm text-slate-800 mb-3 pb-2 border-b border-base-200">
            Referrals by Inquiry Source
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {analytics.by_source.map((s) => (
              <div key={s.source} className="p-3 bg-base-200/40 rounded-lg">
                <div className="text-xs font-semibold text-slate-700 truncate" title={s.source}>{s.source}</div>
                <div className="text-lg font-bold text-primary mt-1">{s.count}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
