import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function CaregiverClientCarePlanPage() {
  const { clientId } = useParams();
  const { data, loading, error } = useFetch(`/caregivers/me/clients/${clientId}/care-plan`, { enabled: !!clientId });

  if (loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading care plan...
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-error mb-4">
          <span>Unable to load care plan: {error.message || 'You may not be assigned to this client.'}</span>
        </div>
        <Link to="/caregiver/clients" className="btn btn-outline btn-sm">
          Back to My Clients
        </Link>
      </PageContainer>
    );
  }

  const carePlan = data?.care_plan;
  const client = data?.client;

  return (
    <PageContainer>
      <div className="mb-2">
        <Link to="/caregiver/clients" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to My Clients
        </Link>
      </div>

      <PageHeader
        title={`Care Plan: ${carePlan?.client_name || client?.first_name || 'Client'}`}
        subtitle="Read-only plan of care instructions"
        actions={
          carePlan?.plan_status ? (
            <StatusBadge status={carePlan.plan_status} label={carePlan.plan_status} />
          ) : null
        }
      />

      {!carePlan ? (
        <EmptyState
          title="No care plan filed"
          description="No care plan has been filed for this client yet."
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Plan Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Primary Nurse</span>
                <span className="text-sm font-semibold text-slate-900">{carePlan.primary_nurse || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Effective Date</span>
                <span className="text-sm font-semibold text-slate-900">{carePlan.effective_date || 'N/A'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Daily Activities & Duties
            </h2>
            {!carePlan.daily_activities || carePlan.daily_activities.length === 0 ? (
              <p className="text-xs text-slate-500 m-0">No scheduled activities listed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="border-b border-base-300 text-slate-500 text-xs">
                      <th>Task</th>
                      <th>Frequency</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carePlan.daily_activities.map((act, idx) => (
                      <tr key={idx} className="border-b border-base-300/60 hover:bg-base-200/50">
                        <td className="font-semibold text-slate-900 text-xs">{act.task}</td>
                        <td className="text-slate-600 text-xs">{act.frequency || 'As scheduled'}</td>
                        <td className="text-slate-500 text-xs">{act.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {carePlan.emergency_protocol && (
            <Card className="p-5 border-l-4 border-l-amber-500">
              <h2 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
                Emergency Protocol
              </h2>
              <p className="text-xs text-slate-700 leading-normal whitespace-pre-wrap m-0">
                {carePlan.emergency_protocol}
              </p>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
