import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';

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
  const {
    data,
    isLoading: loading,
    error: errorMsg,
  } = useFetch('/admin/reports', {
    enabled: !!token,
  });

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Reports" />
        <div className="py-16 text-center text-slate-500 text-sm">
          <div className="loading loading-spinner loading-md text-primary mb-2" />
          <div>Loading operational reports...</div>
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="Reports" />
        {errorMsg && (
          <div role="alert" className="alert alert-error text-sm py-2 px-4 rounded-box">
            {errorMsg}
          </div>
        )}
      </PageContainer>
    );
  }

  const compliance = data.caregiver_compliance || { rows: [], total: 0, compliant: 0 };
  const credentials = data.expiring_credentials || { rows: [], total: 0 };
  const training = data.training_completion || { rows: [], total_courses: 0 };
  const authorizations = data.client_authorizations || { summary: {}, rows: [] };
  const sources = data.referral_sources || { rows: [], total: 0 };
  const inquiries = data.website_inquiries || { by_state: [], recent: [], total: 0 };

  const stats = [
    { label: 'Compliant caregivers', value: `${compliance.compliant}/${compliance.total}` },
    { label: 'Credential issues', value: `${credentials.total}`, highlight: credentials.total > 0 },
    { label: 'Courses tracked', value: `${training.total_courses}` },
    { label: 'Active authorizations', value: `${authorizations.summary.active ?? 0}` },
    { label: 'Total referrals', value: `${sources.total}` },
    { label: 'Web inquiries', value: `${inquiries.total}` },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description={`Operational snapshot across all states, generated ${data.generated_at ? new Date(data.generated_at).toLocaleString() : ''}.`}
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.highlight ? 'text-error' : 'text-slate-900'}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Caregiver compliance */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">Caregiver Compliance</h2>
          <span className={`badge badge-sm ${compliance.compliant === compliance.total ? 'badge-success badge-soft' : 'badge-error badge-soft'} font-medium`}>
            {compliance.compliant} of {compliance.total} compliant
          </span>
        </div>
        {compliance.rows.length === 0 ? (
          <EmptyState title="No caregivers found" message="No caregiver records available." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Caregiver</th>
                  <th>State</th>
                  <th className="text-right">Missing</th>
                  <th className="text-right">Expired</th>
                  <th className="text-right">Expiring</th>
                  <th className="text-right">Valid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {compliance.rows.map((r) => (
                  <tr key={r.caregiver_id} className="hover:bg-base-200/40 transition-colors">
                    <td>
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.email || 'No portal email'}</div>
                    </td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">{r.state_code || '—'}</span>
                    </td>
                    <td className="text-right text-xs text-slate-600">{r.missing}</td>
                    <td className="text-right text-xs text-slate-600">{r.expired}</td>
                    <td className="text-right text-xs text-slate-600">{r.expiring_soon}</td>
                    <td className="text-right text-xs text-slate-600">{r.valid}</td>
                    <td>
                      <StatusBadge
                        status={r.compliant ? 'active' : 'error'}
                        label={r.compliant ? 'Compliant' : 'Action needed'}
                      />
                      {r.missing_names?.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">Missing: {r.missing_names.join(', ')}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Expiring credentials */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">Expiring Credentials</h2>
          <span className="badge badge-sm badge-warning badge-soft font-medium">{credentials.total} total</span>
        </div>
        {credentials.rows.length === 0 ? (
          <EmptyState title="No expiring credentials" message="No credentials expiring or expired in the next 30 days." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Caregiver</th>
                  <th>Credential</th>
                  <th>State</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {credentials.rows.map((r, i) => (
                  <tr key={`${r.caregiver_id}-${r.document_name}-${i}`} className="hover:bg-base-200/40 transition-colors">
                    <td className="font-medium text-slate-900">{r.caregiver_name}</td>
                    <td className="text-slate-600 text-xs">{r.document_name}</td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">{r.state_code || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.expiration_date)}</td>
                    <td>
                      <StatusBadge
                        status={r.status === 'expired' ? 'expired' : 'warning'}
                        label={r.status === 'expired' ? `Expired ${daysLabel(r.days_remaining)}` : daysLabel(r.days_remaining)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* In-service completion */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">In-Service Training Completion</h2>
          <span className="badge badge-sm badge-ghost font-medium">{training.total_courses} courses</span>
        </div>
        {training.rows.length === 0 ? (
          <EmptyState title="No course enrollments" message="No training courses have enrollments yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Course</th>
                  <th>State</th>
                  <th className="text-right">Enrolled</th>
                  <th className="text-right">Completed</th>
                  <th className="text-right">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {training.rows.map((r) => (
                  <tr key={r.course_id} className="hover:bg-base-200/40 transition-colors">
                    <td className="font-medium text-slate-900">{r.name}</td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">{r.state_code || '—'}</span>
                    </td>
                    <td className="text-right text-xs text-slate-600">{r.enrolled}</td>
                    <td className="text-right text-xs text-slate-600">{r.completed}</td>
                    <td className="text-right">
                      <span className={`badge badge-sm ${r.completion_pct === 100 ? 'badge-success badge-soft' : 'badge-ghost'} font-medium`}>
                        {r.completion_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Client authorizations */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">Client Authorizations</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {['active', 'expiring_soon', 'expired', 'pending', 'rejected'].map((s) => (
              <span key={s} className="badge badge-xs badge-ghost font-medium">
                {s.replace('_', ' ')}: {authorizations.summary[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
        {authorizations.rows.length === 0 ? (
          <EmptyState title="No authorizations" message="No authorizations on record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Authorization</th>
                  <th>Client</th>
                  <th>State</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {authorizations.rows.map((r) => (
                  <tr key={r.authorization_number || `${r.client_name}-${r.end_date}`} className="hover:bg-base-200/40 transition-colors">
                    <td className="font-mono text-xs font-medium text-slate-900 whitespace-nowrap">{r.authorization_number || '—'}</td>
                    <td className="font-medium text-slate-900">{r.client_name}</td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">{r.state_code || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.start_date)}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.end_date)}</td>
                    <td>
                      <StatusBadge status={r.status || 'neutral'} label={r.status ? r.status.replace('_', ' ') : '—'} />
                      <div className="text-[11px] text-slate-500 mt-0.5">{daysLabel(r.days_left)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Referral sources */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">Referral Sources</h2>
          <span className="badge badge-sm badge-ghost font-medium">{sources.total} total</span>
        </div>
        {sources.rows.length === 0 ? (
          <EmptyState title="No referrals" message="No referrals recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Source</th>
                  <th className="text-right">Referrals</th>
                  <th>By State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {sources.rows.map((r) => (
                  <tr key={r.source} className="hover:bg-base-200/40 transition-colors">
                    <td className="font-medium text-slate-900">{r.source}</td>
                    <td className="text-right text-xs font-semibold text-slate-900">{r.count}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(r.states || []).map((s) => (
                          <span key={s.code} className="badge badge-xs badge-neutral badge-soft">
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
      </Card>

      {/* Website inquiries */}
      <Card className="overflow-hidden mb-6">
        <div className="p-4 border-b border-base-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 m-0">Website Inquiries</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {inquiries.by_state.map((s) => (
              <span key={s.code} className="badge badge-xs badge-neutral badge-soft">
                {s.code}: {s.count}
              </span>
            ))}
          </div>
        </div>
        {inquiries.recent.length === 0 ? (
          <EmptyState title="No inquiries" message="No website inquiries recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Lead</th>
                  <th>State</th>
                  <th>Contact</th>
                  <th>Received</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {inquiries.recent.map((r) => (
                  <tr key={r.id} className="hover:bg-base-200/40 transition-colors">
                    <td className="font-medium text-slate-900">
                      {r.first_name} {r.last_name}
                    </td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-medium">{r.state_code || '—'}</span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {r.phone || 'No phone'}
                      {r.email && ` · ${r.email}`}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.created_at)}</td>
                    <td>
                      <StatusBadge status={r.status || 'neutral'} label={r.status || '—'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
