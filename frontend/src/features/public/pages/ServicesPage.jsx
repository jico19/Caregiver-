import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function ServicesPage() {
  const { state } = useParams();
  const { data, isLoading: loading, error: errorText } = useFetch(`/states/${state}/services`, { defaultData: [] });

  const services = data?.services || [];
  const error = errorText || null;
  const stateName = state ? state.charAt(0).toUpperCase() + state.slice(1) : '';

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={
          <Link to={`/${state}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            ← Back to {stateName} Home
          </Link>
        }
        title={`Home Care Services in ${stateName}`}
        subtitle="State approved programs for elderly care, disability assistance, and skilled nursing."
      />

      {loading && (
        <LoadingState
          title={`Loading ${stateName} Service Programs...`}
          subtitle={`Retrieving licensed Medicaid & private-pay services for ${stateName}...`}
          variant="cards"
          count={3}
        />
      )}

      {error && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{error}</span>
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <EmptyState
          title={`No specialized listings published yet for ${stateName}`}
          description={`We offer personal care, companion care, respite care, and skilled nursing across all licensed counties in ${stateName}.`}
          action={
            <div className="flex justify-center gap-3">
              <Link
                to={`/${state}/contact`}
                className="btn btn-primary btn-sm"
              >
                Contact {stateName} Coordinator
              </Link>
              <Link
                to="/client/login"
                className="btn btn-outline btn-sm text-slate-700"
              >
                Start Intake
              </Link>
            </div>
          }
        />
      )}

      {!loading && !error && services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((svc) => (
            <Card key={svc.id} title={svc.name}>
              <p className="text-xs text-slate-600 leading-normal m-0 mt-1">
                {svc.description}
              </p>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}