import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';

export default function StatePage() {
  const { state } = useParams();
  const { data: stateInfo, isLoading: stateLoading, error: stateError } = useFetch(`/states/${state}`);
  const { data: servicesRes, isLoading: servicesLoading, error: servicesError } = useFetch(`/states/${state}/services`, { defaultData: [] });

  const services = servicesRes?.services || [];
  const loading = stateLoading || servicesLoading;
  const error = stateError || servicesError || null;

  if (loading) {
    const formattedState = state ? state.charAt(0).toUpperCase() + state.slice(1) : 'State';
    return (
      <LoadingState
        title={`Loading ${formattedState} Healthcare Office...`}
        subtitle={`Querying database for ${formattedState} programs & credentials...`}
        variant="page"
      />
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-soft alert-error max-w-lg mx-auto my-8">
          <div>
            <h2 className="font-bold text-sm">Location Not Found</h2>
            <p className="text-xs mt-1">{error}</p>
          </div>
          <Link to="/florida" className="btn btn-sm btn-outline text-slate-800">
            Go to Florida Office
          </Link>
        </div>
      </PageContainer>
    );
  }

  const displayName = stateInfo?.name || state.charAt(0).toUpperCase() + state.slice(1);
  const code = stateInfo?.code || '';

  return (
    <PageContainer>
      <PageHeader
        title={`Healthcare & Home Care in ${displayName}`}
        subtitle={`Providing compassionate, licensed home care and specialized health assistance tailored to ${displayName} regulatory standards and Medicaid programs.`}
        badge={code ? <StatusBadge status={code} variant="info" label={`${code} Branch`} /> : null}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        <Card
          title="For Caregivers"
          subtitle={`Join our certified caregiver team in ${displayName}. Apply online, submit credentials, and complete required in-service training.`}
        >
          <div className="mt-4">
            <Link
              to="/caregiver/login"
              className="btn btn-primary btn-sm"
            >
              Caregiver Portal & Application →
            </Link>
          </div>
        </Card>

        <Card
          title="For Clients & Families"
          subtitle={`Receive personalized home care support in ${displayName}. Manage care plans, authorizations, and service schedules.`}
        >
          <div className="mt-4">
            <Link
              to="/client/login"
              className="btn btn-outline btn-sm text-slate-800 hover:bg-slate-100"
            >
              Client & Family Portal →
            </Link>
          </div>
        </Card>
      </section>

      <section className="my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-slate-900 m-0">
            Available Services in {displayName}
          </h2>
          <Link to={`/${state}/services`} className="text-xs text-slate-700 hover:text-green-700 underline font-medium">
            View all services →
          </Link>
        </div>

        {services.length === 0 ? (
          <EmptyState
            title={`Services catalog for ${displayName} is being updated`}
            description="Contact our local office directly for program inquiries and admission questions."
            action={
              <Link to={`/${state}/contact`} className="btn btn-sm btn-outline text-slate-700">
                Contact Local Office
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((svc) => (
              <Card key={svc.id} title={svc.name} compact>
                <p className="text-xs text-slate-600 leading-normal m-0 mt-1">
                  {svc.description}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}