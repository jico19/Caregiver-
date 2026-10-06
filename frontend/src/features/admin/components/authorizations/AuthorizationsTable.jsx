import { getAuthStatusDetails, STATUS_DAYS_CLASS, STATUS_BADGE_CLASS } from '../../constants/authorizationConstants';

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
    <div className="table-card">
      {loading ? (
        <div className="table-loading">
          <div className="spinner-md" />
          <div className="mt-3">Loading Medicaid authorizations...</div>
        </div>
      ) : filteredAuthorizations.length === 0 ? (
        <div className="table-empty">
          <svg className="empty-icon" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="card-title mb-1">
            {totalCount === 0 ? 'No Authorizations on Record' : 'No Matching Authorizations Found'}
          </h3>
          <p className="empty-text">
            {totalCount === 0
              ? 'Issue your first Medicaid service authorization using the form above.'
              : 'Try adjusting your search terms, state, or status filters.'}
          </p>
          {totalCount === 0 ? (
            <button
              type="button"
              onClick={onOpenForm}
              className="btn-success"
            >
              + Issue First Authorization
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetFilters}
              className="btn-reset"
            >
              Clear Search & Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table-auth">
            <thead>
              <tr className="table-head-row">
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
            <tbody>
              {filteredAuthorizations.map((a) => {
                const statusInfo = getAuthStatusDetails(a.start_date, a.end_date, a.status);
                const isCopied = copiedAuthId === a.id;

                return (
                  <tr key={a.id} className="table-row">
                    {/* Auth Number + Copy Button */}
                    <td className="whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span className="auth-number">
                          {a.authorization_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopyAuthNumber(a.authorization_number, a.id)}
                          title="Copy Authorization #"
                          className={`btn-copy ${isCopied ? 'btn-copy-copied' : ''}`}
                        >
                          {isCopied ? (
                            <span className="copy-confirm">✓ Copied</span>
                          ) : (
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Client */}
                    <td>
                      <div className="cell-strong">
                        {a.clients?.first_name} {a.clients?.last_name}
                      </div>
                      {a.clients?.medicaid_number && (
                        <div className="cell-sub">
                          Medicaid: <span className="font-mono">{a.clients.medicaid_number}</span>
                        </div>
                      )}
                    </td>

                    {/* State */}
                    <td>
                      <span className="state-chip">
                        {a.states?.code || 'FL'}
                      </span>
                    </td>

                    {/* Start Date */}
                    <td className="cell-muted whitespace-nowrap">
                      {a.start_date}
                    </td>

                    {/* End Date + Days countdown */}
                    <td className="whitespace-nowrap">
                      <div className="cell-medium">{a.end_date}</div>
                      <div className={STATUS_DAYS_CLASS[statusInfo.statusKey] || 'days-text'}>
                        {statusInfo.daysText}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap">
                      <span className={STATUS_BADGE_CLASS[statusInfo.statusKey] || 'badge badge-ghost'}>
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="cell-notes">
                      {a.notes ? (
                        <div className="truncate" title={a.notes}>
                          {a.notes}
                        </div>
                      ) : (
                        <span className="text-italic-muted">Standard authorization</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap">
                      {a.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReview(a.id, 'approved')}
                            disabled={reviewingId === a.id}
                            className="btn-sm btn-success"
                          >
                            {reviewingId === a.id && reviewAction === 'approved' ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReview(a.id, 'rejected')}
                            disabled={reviewingId === a.id}
                            className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                          >
                            {reviewingId === a.id && reviewAction === 'rejected' ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <a
                          href={`/admin/clients/${a.client_id}`}
                          className="text-sm font-medium text-secondary underline"
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
    </div>
  );
}
