import Card from '../../../../shared/components/common/Card';
import EmptyState from '../../../../shared/components/common/EmptyState';
import StatusBadge from '../../../../shared/components/common/StatusBadge';
import { getAuthStatusDetails, calculateUnitProgress } from '../../constants/authorizationConstants';
import { downloadDocument } from '../../../../shared/utils/documentUtils';

export default function AuthorizationsTable({
  loading,
  token,
  totalCount,
  filteredAuthorizations,
  copiedAuthId,
  onCopyAuthNumber,
  reviewingId,
  reviewAction,
  onReview,
  onEdit,
  onOpenForm,
  onResetFilters,
}) {
  return (
    <Card className="overflow-hidden">
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <div className="loading loading-spinner loading-md text-primary" />
          <div className="mt-3 text-sm">Loading Medicaid authorizations...</div>
        </div>
      ) : filteredAuthorizations.length === 0 ? (
        <EmptyState
          title={totalCount === 0 ? 'No Authorizations on Record' : 'No Matching Authorizations Found'}
          message={
            totalCount === 0
              ? 'Issue your first Medicaid service authorization using the form above.'
              : 'Try adjusting your search terms, state, or status filters.'
          }
          action={
            totalCount === 0 ? (
              <button
                type="button"
                onClick={onOpenForm}
                className="btn btn-primary btn-sm"
              >
                + Issue First Authorization
              </button>
            ) : (
              <button
                type="button"
                onClick={onResetFilters}
                className="btn btn-ghost btn-sm text-slate-600"
              >
                Clear Search & Filters
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                <th>Authorization #</th>
                <th>Client</th>
                <th>State</th>
                <th>Procedure (HCPCS)</th>
                <th>Units & Balance</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Covered Services / Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200 text-sm">
              {filteredAuthorizations.map((a) => {
                const statusInfo = getAuthStatusDetails(a.start_date, a.end_date, a.status);
                const isCopied = copiedAuthId === a.id;
                const totalUnits = a.total_units_authorized ?? 0;
                const unitsUsed = a.units_used ?? 0;
                const remainingHours = a.remaining_hours ?? (a.unit_type === '15_min' ? ((totalUnits - unitsUsed) * 0.25).toFixed(1) : (totalUnits - unitsUsed));
                const progress = calculateUnitProgress(totalUnits, unitsUsed);

                return (
                  <tr key={a.id} className="hover:bg-base-200/40 transition-colors">
                    {/* Auth Number + Copy Button */}
                    <td className="whitespace-nowrap font-mono text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">
                          {a.authorization_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopyAuthNumber(a.authorization_number, a.id)}
                          title="Copy Authorization #"
                          className="btn btn-ghost btn-xs btn-circle h-6 w-6 min-h-0 text-slate-400 hover:text-slate-600"
                        >
                          {isCopied ? (
                            <span className="text-[10px] text-success font-sans font-semibold">✓</span>
                          ) : (
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Client */}
                    <td>
                      <div className="font-medium text-slate-900">
                        {a.clients?.first_name} {a.clients?.last_name}
                      </div>
                      {a.clients?.medicaid_number && (
                        <div className="text-xs text-slate-500 font-mono">
                          ID: {a.clients.medicaid_number}
                        </div>
                      )}
                    </td>

                    {/* State */}
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">
                        {a.states?.code || 'FL'}
                      </span>
                    </td>

                    {/* Procedure & Code */}
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="badge badge-sm badge-outline font-mono font-semibold text-primary">
                          {a.hcpcs_code || 'T1019'}
                        </span>
                        <span className="text-xs text-slate-700">
                          {a.service_description || 'Personal Care'}
                        </span>
                      </div>
                    </td>

                    {/* Units & Balance Progress */}
                    <td>
                      <div className="w-40">
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <span className="font-medium text-slate-800">
                            {unitsUsed} / {totalUnits} u
                          </span>
                          <span className={`font-medium ${Number(remainingHours) < 0 ? 'text-error font-semibold' : 'text-primary'}`}>
                            {Number(remainingHours) < 0 ? `${Math.abs(Number(remainingHours))}h over` : `${remainingHours}h left`}
                          </span>
                        </div>
                        <progress
                          className={`progress ${progress.statusColor} h-1.5 w-full`}
                          value={progress.percent}
                          max="100"
                        />
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
                          <span>{progress.percent}% used</span>
                          {a.max_weekly_hours ? <span>Cap: {a.max_weekly_hours}h/wk</span> : null}
                        </div>
                      </div>
                    </td>

                    {/* Start Date */}
                    <td className="text-slate-500 whitespace-nowrap text-xs">
                      {a.start_date}
                    </td>

                    {/* End Date + Days countdown */}
                    <td className="whitespace-nowrap">
                      <div className="text-slate-900 font-medium text-xs">{a.end_date}</div>
                      <div className="text-[11px] text-slate-500">
                        {statusInfo.daysText}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap">
                      <StatusBadge status={statusInfo.statusKey} label={statusInfo.label} />
                    </td>

                    {/* Notes & Document */}
                    <td className="max-w-xs text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {a.notes ? (
                          <span className="truncate text-slate-600 max-w-[180px]" title={a.notes}>
                            {a.notes}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Standard authorization</span>
                        )}
                        {a.document_id && (
                          <button
                            type="button"
                            onClick={() => downloadDocument(a.document_id, token)}
                            className="btn btn-ghost btn-xs text-primary font-semibold gap-0.5 px-1.5 h-5 min-h-0 text-[11px] border border-primary/20"
                            title="View uploaded authorization document"
                          >
                            Doc ↗
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap">
                      {a.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(a)}
                              className="btn btn-xs btn-ghost border border-base-300 text-xs"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onReview(a.id, 'approved')}
                            disabled={reviewingId === a.id}
                            className="btn btn-xs btn-primary"
                          >
                            {reviewingId === a.id && reviewAction === 'approved' ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReview(a.id, 'rejected')}
                            disabled={reviewingId === a.id}
                            className="btn btn-xs btn-outline btn-error"
                          >
                            {reviewingId === a.id && reviewAction === 'rejected' ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(a)}
                              className="btn btn-xs btn-ghost border border-base-300 text-xs"
                            >
                              Edit
                            </button>
                          )}
                          <a
                            href={`/admin/clients/${a.client_id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
