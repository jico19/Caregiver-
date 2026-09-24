import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';

export default function LicensingPage() {
  const { state = 'florida' } = useParams();
  const [licensing, setLicensing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/states/${state}/licensing`)
      .then((res) => {
        if (!isMounted) return;
        setLicensing(res?.licensing || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(`Failed to load ${stateName} licensing disclosures.`);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [state]);

  return (
    <div className="page-container">
      <div className="page-head">
        <Link to={`/${state}`} className="text-secondary text-sm">
          ← Back to {stateName} Office
        </Link>
        <h1 className="page-title mt-2 mb-1">
          State Licensing & Accreditation: {stateName}
        </h1>
        <p className="page-subtitle">
          Full disclosure of agency operating certificates, Medicaid provider authorizations, and clinical compliance standards.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <LoadingState
          title={`Loading ${stateName} Licensing & Accreditation...`}
          subtitle={`Retrieving state compliance records for ${stateName}...`}
          variant="cards"
          count={2}
        />
      ) : licensing.length === 0 ? (
        <div className="card-dashed">
          Licensing records are being updated for {stateName}.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {licensing.map((item) => (
            <div
              key={item.id}
              className="card"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-green">
                  ACTIVE CERTIFICATION
                </span>
                <h2 className="heading-card">
                  {item.title}
                </h2>
              </div>
              <p className="text-secondary text-sm leading-normal">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Compliance Quality Standard */}
      <div className="banner-info mt-8">
        <h3 className="banner-title">
          Continuous Clinical Compliance
        </h3>
        <p className="banner-text">
          All agency caregivers in {stateName} undergo statewide Level 2 fingerprint background screening, annual TB testing, drug testing, and ongoing mandatory in-service education under registered nurse supervision.
        </p>
      </div>
    </div>
  );
}