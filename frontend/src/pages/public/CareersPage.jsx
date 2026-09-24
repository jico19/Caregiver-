import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import { packetUrl } from '../../utils/packets';

export default function CareersPage() {
  const { state = 'florida' } = useParams();
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg('');

    api.get(`/states/${state}/careers`)
      .then((res) => {
        if (!isMounted) return;
        setCareers(res?.careers || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMsg(`Failed to load ${stateName} career postings.`);
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
      <div className="page-head mb-8">
        <Link to={`/${state}`} className="text-secondary text-sm">
          ← Back to {stateName} Office
        </Link>
        <h1 className="page-title page-title-lg mt-2 mb-2">
          Caregiver Careers in {stateName}
        </h1>
        <p className="page-subtitle page-subtitle-md">
          Join our accredited home care clinical team. We offer competitive weekly pay, flexible scheduling, paid in-service training, and comprehensive career development.
        </p>
      </div>

      {/* Benefits Banner */}
      <div className="banner-info flex justify-between items-center flex-wrap gap-4 mb-8">
        <div>
          <h2 className="banner-title">
            Ready to become a certified caregiver?
          </h2>
          <p className="banner-text">
            Register your candidate profile and submit credentials online in less than 10 minutes.
          </p>
        </div>
        <Link
          to={`/caregiver/application?state=${state}`}
          className="btn-primary btn-emphasis"
        >
          Apply Online Now
        </Link>
        <a
          href={packetUrl(state)}
          target="_blank"
          rel="noreferrer"
          className="btn-outline-secondary btn-emphasis"
        >
          Download Employment Packet
        </a>
      </div>

      {/* Status Messages */}
      {loading && (
        <LoadingState
          title={`Loading Career Openings in ${stateName}...`}
          subtitle={`Fetching job listings and wage rates for ${stateName}...`}
          variant="cards"
          count={3}
        />
      )}

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {/* Dynamic Openings Grid */}
      {!loading && !errorMsg && careers.length === 0 && (
        <div className="card-dashed">
          <h3 className="card-title mb-2">
            No current public openings in {stateName}
          </h3>
          <p className="text-secondary text-sm max-w-[480px] mx-auto mb-5">
            We review candidate profiles continuously. Submit your general caregiver application and credential portfolio to be contacted for future openings.
          </p>
          <Link
            to={`/caregiver/application?state=${state}`}
            className="btn-primary"
          >
            Submit General Application
          </Link>
        </div>
      )}

      {!loading && !errorMsg && careers.length > 0 && (
        <div className="flex flex-col gap-4">
          {careers.map((job) => (
            <div
              key={job.id}
              className="card flex flex-col gap-3"
            >
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="heading-card">
                    {job.title}
                  </h3>
                  <span className="text-sm text-success font-semibold">
                    {job.compensation}
                  </span>
                  <span className="text-muted mx-2">·</span>
                  <span className="text-secondary text-sm">
                    {job.job_type}
                  </span>
                </div>

                <Link
                  to={`/caregiver/application?state=${state}&job=${encodeURIComponent(job.title)}`}
                  className="btn-primary btn-compact"
                >
                  Apply Now
                </Link>
              </div>

              {job.description && (
                <p className="text-secondary text-sm leading-normal">
                  {job.description}
                </p>
              )}

              {job.requirements && (
                <div className="requirements-note">
                  <strong>Requirements:</strong> {job.requirements}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}