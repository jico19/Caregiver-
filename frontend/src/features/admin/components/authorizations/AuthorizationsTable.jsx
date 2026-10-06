import Card from '../../../../shared/components/common/Card';
import EmptyState from '../../../../shared/components/common/EmptyState';
import StatusBadge from '../../../../shared/components/common/StatusBadge';
import { getAuthStatusDetails } from '../../constants/authorizationConstants';

export default function AuthorizationsTable({
  loading,
  totalCount,
  filteredAuthorizations,
  copiedAuthId,
  onCopyAuthNumber,
  reviewingId,
  reviewAction,
  onReview,
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

                    {/* Notes */}
                    <td className="max-w-xs text-xs">
                      {a.notes ? (
                        <div className="truncate text-slate-600" title={a.notes}>
                          {a.notes}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Standard authorization</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap">
                      {a.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
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
                        <a
                          href={`/admin/clients/${a.client_id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View client
                        </a>
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
