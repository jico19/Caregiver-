import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';

export default function StatePage() {
  const { state } = useParams();
  const [stateInfo, setStateInfo] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get(`/states/${state}`),
      api.get(`/states/${state}/services`),
    ])
      .then(([stateData, servicesData]) => {
        if (!isMounted) return;
        setStateInfo(stateData);
        setServices(servicesData?.services || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.detail || 'Failed to load state information.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [state]);

  if (loading) {
    const formattedState = state ? state.charAt(0).toUpperCase() + state.slice(1) : 'State';
    return (
      <LoadingState
        title={`Loading ${formattedState} Healthcare Office...`}
        subtitle={`Querying Supabase database for ${formattedState} programs & credentials...`}
        variant="page"
      />
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error alert-narrow">
        <h2 className="alert-title">Location Not Found</h2>
        <p className="text-sm">{error}</p>
        <Link to="/florida" className="alert-link">
          Go to Florida Office
        </Link>
      </div>
    );
  }

  const displayName = stateInfo?.name || state.charAt(0).toUpperCase() + state.slice(1);
  const code = stateInfo?.code || '';

  return (
    <div className="page-container">
      <section className="section-rule">
        <div className="badge badge-blue mb-2">
          {code} State Branch
        </div>
        <h1 className="page-title page-title-lg">
          Healthcare & Home Care in {displayName}
        </h1>
        <p className="page-subtitle page-subtitle-lg">
          Providing compassionate, licensed home care and specialized health assistance tailored to {displayName} regulatory standards and Medicaid programs.
        </p>
      </section>

      <section className="grid grid-cols-2 max-md:grid-cols-1 gap-6 py-8">
        <div className="card-muted">
          <h2 className="mb-2">For Caregivers</h2>
          <p className="text-secondary text-sm mb-4">
            Join our certified caregiver team in {displayName}. Apply online, submit credentials, and complete required in-service training.
          </p>
          <Link
            to="/caregiver/login"
            className="btn-primary"
          >
            Caregiver Application & Portal
          </Link>
        </div>

        <div className="card-muted">
          <h2 className="mb-2">For Clients & Families</h2>
          <p className="text-secondary text-sm mb-4">
            Receive personalized home care support in {displayName}. Manage care plans, authorizations, and service schedules.
          </p>
          <Link
            to="/client/login"
            className="btn-success"
          >
            Client Intake & Portal
          </Link>
        </div>
      </section>

      <section className="py-4">
        <div className="flex justify-between items-center mb-4">
          <h2>Available Services in {displayName}</h2>
          <Link to={`/${state}/services`} className="text-sm">
            View all services →
          </Link>
        </div>

        {services.length === 0 ? (
          <div className="card-dashed">
            <p>Services catalog for {displayName} is currently being updated.</p>
            <p className="text-sm mt-2">
              Contact our local office directly at <Link to={`/${state}/contact`}>Contact Page</Link> for program inquiries.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
            {services.map((svc) => (
              <div key={svc.id} className="card p-4">
                <h3 className="card-title-sm">{svc.name}</h3>
                <p className="text-secondary text-sm">{svc.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}