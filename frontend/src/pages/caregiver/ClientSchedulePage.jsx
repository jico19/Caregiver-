import { useParams, Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';

export default function CaregiverClientSchedulePage() {
  const { clientId } = useParams();
  const { data, loading, error } = useFetch(`/caregivers/me/clients/${clientId}/schedule`, { enabled: !!clientId });

  if (loading) {
    return (
      <div className="portal-container">
        <div className="portal-card">Loading visit schedule...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-container">
        <div className="portal-card error-card">
          <p>Unable to load schedule: {error.message || 'You may not be assigned to this client.'}</p>
          <Link to="/caregiver/clients" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
            Back to My Clients
          </Link>
        </div>
      </div>
    );
  }

  const schedule = data?.schedule || [];
  const client = data?.client;

  return (
    <div className="portal-container">
      <div className="portal-header">
        <div>
          <Link to="/caregiver/clients" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
            ← Back to My Clients
          </Link>
          <h1 className="portal-title" style={{ marginTop: '0.25rem' }}>
            Visit Schedule: {client?.first_name ? `${client.first_name} ${client.last_name}` : 'Client'}
          </h1>
          <p className="portal-subtitle">Scheduled care visits and assignments</p>
        </div>
      </div>

      {schedule.length === 0 ? (
        <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            No visit schedules are currently posted for this client.
          </p>
        </div>
      ) : (
        <div className="portal-card">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Service</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.day_of_week || item.day}</strong></td>
                  <td>{item.start_time ? `${item.start_time} - ${item.end_time}` : item.time || 'TBD'}</td>
                  <td>{item.service || 'Personal Care'}</td>
                  <td>
                    <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                      {item.status || 'Scheduled'}
                    </span>
                  </td>
                  <td>{item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
