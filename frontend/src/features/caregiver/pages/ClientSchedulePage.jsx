import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function CaregiverClientSchedulePage() {
  const { clientId } = useParams();
  const { data, loading, error } = useFetch(`/caregivers/me/clients/${clientId}/schedule`, { enabled: !!clientId });

  if (loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading visit schedule...
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-error mb-4">
          <span>Unable to load schedule: {error.message || 'You may not be assigned to this client.'}</span>
        </div>
        <Link to="/caregiver/clients" className="btn btn-outline btn-sm">
          Back to My Clients
        </Link>
      </PageContainer>
    );
  }

  const schedule = data?.schedule || [];
  const client = data?.client;

  return (
    <PageContainer>
      <div className="mb-2">
        <Link to="/caregiver/clients" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to My Clients
        </Link>
      </div>

      <PageHeader
        title={`Visit Schedule: ${client?.first_name ? `${client.first_name} ${client.last_name}` : 'Client'}`}
        subtitle="Scheduled care visits and assignments"
      />

      {schedule.length === 0 ? (
        <EmptyState
          title="No scheduled visits"
          description="No visit schedules are currently posted for this client."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                  <th>Day</th>
                  <th>Time</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, idx) => (
                  <tr key={idx} className="border-b border-base-300/60 hover:bg-base-200/50">
                    <td className="font-semibold text-slate-900 text-xs">
                      {item.day_of_week || item.day}
                    </td>
                    <td className="text-slate-600 text-xs">
                      {item.start_time ? `${item.start_time} - ${item.end_time}` : item.time || 'TBD'}
                    </td>
                    <td className="text-slate-600 text-xs">{item.service || 'Personal Care'}</td>
                    <td>
                      <StatusBadge
                        status={item.status || 'scheduled'}
                        label={item.status || 'Scheduled'}
                      />
                    </td>
                    <td className="text-slate-500 text-xs">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
