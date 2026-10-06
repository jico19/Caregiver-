import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import DataTable from '../../../shared/components/common/DataTable';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import LoadingState from '../../../shared/components/common/LoadingState';

export default function CarePlanPage() {
  const { token } = useAuth();
  const { data, isLoading: loading, error: errorMsg } = useFetch('/clients/me/care-plan', {
    enabled: !!token,
    defaultData: { care_plan: null },
  });
  const carePlan = data?.care_plan || null;

  if (loading) {
    return (
      <LoadingState
        title="Loading Plan of Care..."
        subtitle="Retrieving physician directives and daily care routines..."
        variant="page"
      />
    );
  }

  const columns = [
    { key: 'task', label: 'Activity', render: (val) => <span className="font-semibold text-slate-900">{val}</span> },
    { key: 'frequency', label: 'Frequency', render: (val) => <span className="text-green-700 font-medium">{val}</span> },
    { key: 'notes', label: 'Caregiver Directive', render: (val) => <span className="text-slate-600">{val}</span> },
  ];

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Personalized Plan of Care (POC)"
        subtitle="Clinical supervisor directives, daily assistance routines, and safety instructions."
        badge={carePlan ? <StatusBadge status={carePlan.plan_status || 'active'} /> : null}
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}

      {!carePlan && !errorMsg && (
        <EmptyState
          title="No Plan of Care on File Yet"
          description="Your care coordinator is preparing your personalized plan of care. Once published, your daily care activities and emergency protocol will appear here."
        />
      )}

      {carePlan && (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Care Recipient</span>
                <strong className="text-slate-900 text-sm">{carePlan?.client_name || 'Client'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Clinical Supervisor</span>
                <span className="text-slate-800 font-medium">{carePlan?.primary_nurse || 'Assigned Nurse'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Plan Status</span>
                <StatusBadge status={carePlan?.plan_status || 'active'} size="xs" />
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Effective Date</span>
                <span className="text-slate-800">{carePlan?.effective_date || 'Current'}</span>
              </div>
            </div>
          </Card>

          <Card title="Authorized Daily Living Activities (ADLs)">
            <DataTable
              columns={columns}
              data={carePlan.daily_activities || []}
              keyField="task"
              emptyMessage="No daily living activities recorded."
            />
          </Card>

          {carePlan.emergency_protocol && (
            <div className="p-4 rounded-box border border-red-200 bg-red-50 text-xs text-red-900">
              <h3 className="font-bold text-red-950 text-sm m-0 mb-1">Emergency Protocol</h3>
              <p className="m-0 leading-normal">{carePlan.emergency_protocol}</p>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
