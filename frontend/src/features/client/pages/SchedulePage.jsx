import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';

export default function SchedulePage() {
  const { token } = useAuth();
  const { data, isLoading: loading, error: errorMsg } = useFetch('/clients/me/schedule', {
    enabled: !!token,
    defaultData: { schedule: [] },
  });
  const schedule = data?.schedule || (Array.isArray(data) ? data : []);

  if (loading) {
    return <div className="loading-text">Loading visit schedule...</div>;
  }

  return (
    <div className="container-880">
      <div className="page-head">
        <h1 className="page-title">
          Upcoming Caregiver Visit Schedule
        </h1>
        <p className="page-subtitle">
          Weekly shift appointments confirmed by your agency care coordinator.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {schedule.length === 0 && !errorMsg && (

        <div className="card p-8 text-center">
          <h2 className="card-title mb-1">No Visits Scheduled Yet</h2>
          <p className="empty-text">
            Your care coordinator has not confirmed any caregiver visits yet.
            Once a weekly schedule is set, your visit days and times will appear here.
          </p>
        </div>
      )}

      {schedule.length > 0 && (
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
        {schedule.map((item, idx) => (
          <div
            key={idx}
            className="schedule-card"
          >
            <div>
              <div className="schedule-card-head">
                <strong className="schedule-day">{item.day}</strong>
                <span className={`badge ${item.status === 'Confirmed' ? 'badge-green' : 'badge-blue'}`}>
                  {item.status}
                </span>
              </div>

              <div className="schedule-time">
                {item.time}
              </div>

              <p className="text-secondary text-sm mb-4">
                {item.service}
              </p>
            </div>

            <div className="schedule-footer">
              Assigned Branch: <strong>{item.branch} Office</strong>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
