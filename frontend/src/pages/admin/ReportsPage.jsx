import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const AUTH_STATUS_BADGE = {
  active: 'badge badge-green',
  expiring_soon: 'badge badge-yellow',
  expired: 'badge badge-red',
  pending: 'badge badge-gray',
  rejected: 'badge badge-gray',
};

function fmtDate(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

function daysLabel(days) {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `in ${days}d`;
}

export default function ReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/reports', token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.detail || 'Failed to load reports.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Reports</h1>
        </div>
        <div className="table-loading-sm">Loading reports...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Reports</h1>
        </div>
        {errorMsg && (
          <div role="alert" className="alert alert-error">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  const compliance = data.caregiver_compliance || { rows: [], total: 0, compliant: 0 };
  const credentials = data.expiring_credentials || { rows: [], total: 0 };
  const training = data.training_completion || { rows: [], total_courses: 0 };
  const authorizations = data.client_authorizations || { summary: {}, rows: [] };
  const sources = data.referral_sources || { rows: [], total: 0 };
  const inquiries = data.website_inquiries || { by_state: [], recent: [], total: 0 };

  const stats = [
    { label: 'Compliant caregivers', value: `${compliance.compliant}/${compliance.total}`, cls: 'text-green-700' },
    { label: 'Credential issues', value: `${credentials.total}`, cls: credentials.total ? 'text-red-700' : 'text-gray-700' },
    { label: 'Courses tracked', value: `${training.total_courses}`, cls: 'text-gray-700' },
    { label: 'Active authorizations', value: `${authorizations.summary.active ?? 0}`, cls: 'text-green-700' },
    { label: 'Total referrals', value: `${sources.total}`, cls: 'text-blue-700' },
    { label: 'Web inquiries', value: `${inquiries.total}`, cls: 'text-blue-700' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Operational snapshot across all states, generated{' '}
            {data.generated_at ? new Date(data.generated_at).toLocaleString() : ''}.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs text-muted mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Caregiver compliance */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">Caregiver Compliance</h2>
          <span className={`badge ${compliance.compliant === compliance.total ? 'badge-green' : 'badge-red'}`}>
            {compliance.compliant} of {compliance.total} compliant
          </span>
        </div>
        {compliance.rows.length === 0 ? (
          <div className="table-empty-sm">No caregivers found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>State</th>
                  <th className="text-right">Missing</th>
                  <th className="text-right">Expired</th>
                  <th className="text-right">Expiring</th>
                  <th className="text-right">Valid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {compliance.rows.map((r) => (
                  <tr key={r.caregiver_id}>
                    <td className="cell-strong">
                      {r.name}
                      <div className="cell-sub">{r.email || 'No portal email'}</div>
                    </td>
                    <td className="cell-muted">{r.state_code || '—'}</td>
                    <td className="text-right">{r.missing}</td>
                    <td className="text-right">{r.expired}</td>
                    <td className="text-right">{r.expiring_soon}</td>
                    <td className="text-right">{r.valid}</td>
                    <td>
                      <span className={r.compliant ? 'badge badge-green' : 'badge badge-red'}>
                        {r.compliant ? 'Compliant' : 'Action needed'}
                      </span>
                      {r.missing_names?.length > 0 && (
                        <div className="cell-sub">Missing: {r.missing_names.join(', ')}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expiring credentials */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">Expiring Credentials</h2>
          <span className="badge badge-yellow">{credentials.total} total</span>
        </div>
        {credentials.rows.length === 0 ? (
          <div className="table-empty-sm">No credentials expiring or expired in the next 30 days.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>Credential</th>
                  <th>State</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {credentials.rows.map((r, i) => (
                  <tr key={`${r.caregiver_id}-${r.document_name}-${i}`}>
                    <td className="cell-strong">{r.caregiver_name}</td>
                    <td>{r.document_name}</td>
                    <td className="cell-muted">{r.state_code || '—'}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.expiration_date)}</td>
                    <td>
                      <span className={r.status === 'expired' ? 'badge badge-red' : 'badge badge-yellow'}>
                        {r.status === 'expired' ? `Expired ${daysLabel(r.days_remaining)}` : daysLabel(r.days_remaining)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* In-service completion */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">In-Service Training Completion</h2>
          <span className="badge badge-blue">{training.total_courses} courses</span>
        </div>
        {training.rows.length === 0 ? (
          <div className="table-empty-sm">No training courses have enrollments yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>State</th>
                  <th className="text-right">Enrolled</th>
                  <th className="text-right">Completed</th>
                  <th className="text-right">Completion</th>
                </tr>
              </thead>
              <tbody>
                {training.rows.map((r) => (
                  <tr key={r.course_id}>
                    <td className="cell-strong">{r.name}</td>
                    <td className="cell-muted">{r.state_code || '—'}</td>
                    <td className="text-right">{r.enrolled}</td>
                    <td className="text-right">{r.completed}</td>
                    <td className="text-right">
                      <span className={r.completion_pct === 100 ? 'badge badge-green' : 'badge badge-gray'}>
                        {r.completion_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Client authorizations */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">Client Authorizations</h2>
          <div className="flex flex-wrap items-center gap-2">
            {['active', 'expiring_soon', 'expired', 'pending', 'rejected'].map((s) => (
              <span key={s} className={AUTH_STATUS_BADGE[s]}>
                {s.replace('_', ' ')}: {authorizations.summary[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
        {authorizations.rows.length === 0 ? (
          <div className="table-empty-sm">No authorizations on record.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Authorization</th>
                  <th>Client</th>
                  <th>State</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {authorizations.rows.map((r) => (
                  <tr key={r.authorization_number || `${r.client_name}-${r.end_date}`}>
                    <td className="cell-strong whitespace-nowrap">{r.authorization_number || '—'}</td>
                    <td>{r.client_name}</td>
                    <td className="cell-muted">{r.state_code || '—'}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.start_date)}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.end_date)}</td>
                    <td>
                      <span className={AUTH_STATUS_BADGE[r.status] || 'badge badge-gray'}>
                        {r.status ? r.status.replace('_', ' ') : '—'}
                      </span>
                      <div className="cell-sub">{daysLabel(r.days_left)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Referral sources */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">Referral Sources</h2>
          <span className="badge badge-blue">{sources.total} total</span>
        </div>
        {sources.rows.length === 0 ? (
          <div className="table-empty-sm">No referrals yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="text-right">Referrals</th>
                  <th>By State</th>
                </tr>
              </thead>
              <tbody>
                {sources.rows.map((r) => (
                  <tr key={r.source}>
                    <td className="cell-strong">{r.source}</td>
                    <td className="text-right">{r.count}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        {(r.states || []).map((s) => (
                          <span key={s.code} className="chip-neutral">
                            {s.code}: {s.count}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Website inquiries */}
      <section className="admin-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="section-title m-0">Website Inquiries</h2>
          <div className="flex flex-wrap items-center gap-2">
            {inquiries.by_state.map((s) => (
              <span key={s.code} className="chip-neutral">
                {s.code}: {s.count}
              </span>
            ))}
          </div>
        </div>
        {inquiries.recent.length === 0 ? (
          <div className="table-empty-sm">No website inquiries yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>State</th>
                  <th>Contact</th>
                  <th>Received</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-strong">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="cell-muted">{r.state_code || '—'}</td>
                    <td className="cell-sub">
                      {r.phone || 'No phone'}
                      {r.email && ` · ${r.email}`}
                    </td>
                    <td className="cell-muted whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td>
                      <span className="badge badge-gray">{r.status || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}