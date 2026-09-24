import { useParams, Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import LoadingState from '../../components/common/LoadingState';

export default function ServicesPage() {
  const { state } = useParams();
  const { data, isLoading: loading, error: errorText } = useFetch(`/states/${state}/services`, { defaultData: [] });

  const services = data?.services || [];
  const error = errorText || null;

  const stateName = state ? state.charAt(0).toUpperCase() + state.slice(1) : '';

  return (
    <div className="container-880">
      <div className="page-head">
        <Link to={`/${state}`} className="text-secondary text-sm">
          ← Back to {stateName} Home
        </Link>
        <h1 className="page-title mt-2">
          Home Care Services in {stateName}
        </h1>
        <p className="page-subtitle mt-1">
          State approved programs for elderly care, disability assistance, and skilled nursing.
        </p>
      </div>

      {loading && (
        <LoadingState
          title={`Loading ${stateName} Service Programs...`}
          subtitle={`Retrieving licensed Medicaid & private-pay services for ${stateName}...`}
          variant="cards"
          count={3}
        />
      )}

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <div className="card-dashed">
          <h2 className="card-title">
            No specialized listings published yet for {stateName}
          </h2>
          <p className="text-secondary text-sm max-w-[480px] mx-auto mb-6">
            We offer personal care, companion care, respite care, and skilled nursing across all licensed counties in {stateName}.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to={`/${state}/contact`}
              className="btn-primary"
            >
              Contact {stateName} Coordinator
            </Link>
            <Link
              to="/client/login"
              className="btn-outline-secondary"
            >
              Start Intake
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && services.length > 0 && (
        <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
          {services.map((svc) => (
            <div key={svc.id} className="card p-5">
              <h2 className="card-title">{svc.name}</h2>
              <p className="text-secondary text-sm leading-normal">{svc.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}