import { Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function CaregiverClientsPage() {
  const { data, loading, error } = useFetch('/caregivers/me/clients');

  if (loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading assigned clients...
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-error">
          <span>Failed to load assigned clients: {error.message || 'Unknown error'}</span>
        </div>
      </PageContainer>
    );
  }

  const clients = data?.clients || [];

  return (
    <PageContainer>
      <PageHeader
        title="My Assigned Clients"
        subtitle="Clients currently assigned for service delivery"
      />

      {clients.length === 0 ? (
        <EmptyState
          title="No assigned clients"
          description="You do not currently have any active client assignments."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-semibold text-base text-slate-900 m-0">
                    {client.first_name} {client.last_name}
                  </h3>
                  <span className="badge badge-soft text-slate-700 text-xs capitalize">
                    {client.assignment_role || 'Primary'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-4 leading-normal">
                  {client.phone && <div>📞 {client.phone}</div>}
                  {client.address && <div>📍 {client.address}</div>}
                  {client.states?.name && <div>🌴 State: {client.states.name}</div>}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-base-300">
                <Link
                  to={`/caregiver/clients/${client.id}/care-plan`}
                  className="btn btn-outline btn-xs flex-1"
                >
                  Care Plan
                </Link>
                <Link
                  to={`/caregiver/clients/${client.id}/schedule`}
                  className="btn btn-primary btn-xs flex-1"
                >
                  Schedule
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
