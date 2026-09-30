import { useParams, Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';

export default function CaregiverClientCarePlanPage() {
  const { clientId } = useParams();
  const { data, loading, error } = useFetch(`/caregivers/me/clients/${clientId}/care-plan`, { enabled: !!clientId });

  if (loading) {
    return (
      <div className="portal-container">
        <div className="portal-card">Loading care plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-container">
        <div className="portal-card error-card">
          <p>Unable to load care plan: {error.message || 'You may not be assigned to this client.'}</p>
          <Link to="/caregiver/clients" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
            Back to My Clients
          </Link>
        </div>
      </div>
    );
  }

  const carePlan = data?.care_plan;
  const client = data?.client;

  return (
    <div className="portal-container">
      <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/caregiver/clients" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
            ← Back to My Clients
          </Link>
          <h1 className="portal-title" style={{ marginTop: '0.25rem' }}>
            Care Plan: {carePlan?.client_name || client?.first_name || 'Client'}
          </h1>
          <p className="portal-subtitle">Read-only plan of care instructions</p>
        </div>
        <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
          {carePlan?.plan_status || 'Active'}
        </span>
      </div>

      {!carePlan ? (
        <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            No care plan has been filed for this client yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="portal-card">
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>
              PLAN DETAILS
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Primary Nurse:</strong>
                <div>{carePlan.primary_nurse || 'Unassigned'}</div>
              </div>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Effective Date:</strong>
                <div>{carePlan.effective_date || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="portal-card">
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>
              DAILY ACTIVITIES & DUTIES
            </h3>
            {!carePlan.daily_activities || carePlan.daily_activities.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No scheduled activities listed.</p>
            ) : (
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Frequency</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {carePlan.daily_activities.map((act, idx) => (
                    <tr key={idx}>
                      <td><strong>{act.task}</strong></td>
                      <td>{act.frequency || 'As scheduled'}</td>
                      <td>{act.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {carePlan.emergency_protocol && (
            <div className="portal-card" style={{ borderLeft: '4px solid var(--color-warning, #f59e0b)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--color-warning-dark, #b45309)' }}>
                EMERGENCY PROTOCOL
              </h3>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{carePlan.emergency_protocol}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
