import { Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';

export default function CaregiverClientsPage() {
  const { data, loading, error } = useFetch('/caregivers/me/clients');

  if (loading) {
    return (
      <div className="portal-container">
        <div className="portal-card">Loading assigned clients...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-container">
        <div className="portal-card error-card">
          <p>Failed to load assigned clients: {error.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const clients = data?.clients || [];

  return (
    <div className="portal-container">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">My Assigned Clients</h1>
          <p className="portal-subtitle">Clients currently assigned for service delivery</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            You do not currently have any active client assignments.
          </p>
        </div>
      ) : (
        <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {clients.map((client) => (
            <div key={client.id} className="portal-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    {client.first_name} {client.last_name}
                  </h3>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {client.assignment_role || 'Primary'}
                  </span>
                </div>

                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {client.phone && <div>📞 {client.phone}</div>}
                  {client.address && <div>📍 {client.address}</div>}
                  {client.states?.name && <div>🌴 State: {client.states.name}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                <Link to={`/caregiver/clients/${client.id}/care-plan`} className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                  Care Plan
                </Link>
                <Link to={`/caregiver/clients/${client.id}/schedule`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                  Schedule
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
