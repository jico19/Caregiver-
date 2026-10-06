import { useAuth } from '../../../shared/hooks/useAuth';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
import Pagination from '../../../shared/components/common/Pagination';

export default function AuditLogsPage() {
  const { token } = useAuth();
  const {
    items: logs,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/audit-logs',
    token,
    listKey: 'audit_logs',
  });

  return (
    <PageContainer>
      <PageHeader
        title="Compliance & Security Audit Logs"
        description="Immutable activity stream recording administrative approvals, rejections, and authorization issuances."
      />

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-base-200">
          <h2 className="text-sm font-semibold text-slate-900 m-0">
            Recent Activity Stream ({total})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading system logs...</div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries recorded yet"
            message="Administrative activities such as approvals, status changes, and issuances will be recorded here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Timestamp</th>
                  <th>Actor (Admin)</th>
                  <th>IP Address</th>
                  <th>Action</th>
                  <th>Target Table</th>
                  <th>Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-base-200/40 transition-colors">
                    <td className="text-slate-500 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="font-medium text-slate-900">
                      {log.users?.email || 'System / Admin'}
                    </td>
                    <td className="text-slate-500 whitespace-nowrap font-mono text-xs">
                      {log.ip_address || 'N/A'}
                    </td>
                    <td>
                      <span className="badge badge-sm badge-neutral badge-soft font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="text-slate-600 font-mono text-xs">
                      {log.table_name || 'N/A'}
                    </td>
                    <td className="text-slate-400 font-mono text-xs">
                      {log.record_id ? log.record_id.slice(0, 8) + '...' : 'N/A'}
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
            listLabel="entries"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </PageContainer>
  );
}
