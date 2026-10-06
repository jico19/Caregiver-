import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import LoadingState from '../../../shared/components/common/LoadingState';

export default function SchedulePage() {
  const { token } = useAuth();
  const { data, isLoading: loading, error: errorMsg } = useFetch('/clients/me/schedule', {
    enabled: !!token,
    defaultData: { schedule: [] },
  });
  const schedule = data?.schedule || (Array.isArray(data) ? data : []);

  if (loading) {
    return (
      <LoadingState
        title="Loading Visit Schedule..."
        subtitle="Retrieving confirmed weekly appointments..."
        variant="page"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Upcoming Caregiver Visit Schedule"
        subtitle="Weekly shift appointments confirmed by your agency care coordinator."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}

      {schedule.length === 0 && !errorMsg && (
        <EmptyState
          title="No Visits Scheduled Yet"
          description="Your care coordinator has not confirmed any caregiver visits yet. Once a weekly schedule is set, your visit days and times will appear here."
        />
      )}

      {schedule.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {schedule.map((item, idx) => (
            <Card key={idx} compact>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-base-300">
                <strong className="text-sm font-semibold text-slate-900">{item.day}</strong>
                <StatusBadge status={item.status || 'confirmed'} size="xs" />
              </div>

              <div className="text-base font-bold text-green-700 mb-1">
                {item.time}
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-normal">
                {item.service || 'Personal Care & Assistance'}
              </p>

              <div className="text-xs text-slate-400 pt-2 border-t border-base-300 mt-auto">
                Assigned Branch: <strong className="text-slate-700">{item.branch} Office</strong>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
