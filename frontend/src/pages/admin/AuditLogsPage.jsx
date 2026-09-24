import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function AuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    api.get('/admin/audit-logs', token)
      .then((res) => {
        if (!isMounted) return;
        setLogs(res?.audit_logs || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg('Failed to load audit logs.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="page-container">
      <div className="page-head">
        <h1 className="page-title">
          Compliance & Security Audit Logs
        </h1>
        <p className="page-subtitle">
          Immutable activity stream recording administrative approvals, rejections, and authorization issuances.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      <div className="admin-card">
        <h2 className="section-title">
          Recent Activity Stream ({logs.length})
        </h2>

        {loading ? (
          <div className="table-loading-sm">Loading system logs...</div>
        ) : logs.length === 0 ? (
          <div className="table-empty-sm">
            No administrative actions recorded in audit logs yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin table-admin-sm">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor (Admin)</th>
                  <th>Action</th>
                  <th>Target Table</th>
                  <th>Record ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="cell-strong">
                      {log.users?.email || 'System / Admin'}
                    </td>
                    <td>
                      <span className="chip-neutral">
                        {log.action}
                      </span>
                    </td>
                    <td className="cell-muted">
                      {log.table_name || 'N/A'}
                    </td>
                    <td className="cell-dim">
                      {log.record_id ? log.record_id.slice(0, 8) + '...' : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
