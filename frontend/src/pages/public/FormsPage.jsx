import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';

export default function FormsPage() {
  const { state = 'florida' } = useParams();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.get(`/states/${state}/forms`)
      .then((res) => {
        if (!isMounted) return;
        setForms(res?.forms || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(`Failed to load ${stateName} state forms.`);
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
          {stateName} Client & Regulatory Forms
        </h1>
        <p className="page-subtitle">
          Download state-mandated disclosures, Medicaid intake authorization packets, and client rights documentation.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <LoadingState
          title={`Loading ${stateName} State Forms & Packets...`}
          subtitle={`Retrieving verified regulatory documents for ${stateName}...`}
          variant="table"
          count={3}
        />
      ) : forms.length === 0 ? (
        <div className="card-dashed">
          No downloadable forms currently listed for {stateName}. Please contact our regional office for document packets.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {forms.map((f) => (
            <div
              key={f.id}
              className="card flex justify-between items-center flex-wrap gap-4 p-5"
            >
              <div className="max-w-[680px]">
                <h2 className="card-title mb-1">
                  {f.name}
                </h2>
                <p className="text-secondary text-sm leading-snug">
                  {f.description}
                </p>
              </div>

              <div className="flex gap-2">
                <a
                  href={f.file_url || '#'}
                  download
                  onClick={(e) => {
                    if (f.file_url === '#') {
                      e.preventDefault();
                      alert('This official packet is issued directly upon intake initiation.');
                    }
                  }}
                  className="btn-outline-primary btn-compact"
                >
                  Download Form
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-muted mt-8 p-5">
        <h3 className="card-title-sm mb-1">
          Need to submit completed documents?
        </h3>
        <p className="text-secondary text-sm mb-3">
          You can securely upload signed physician orders and insurance documents directly through the client portal.
        </p>
        <Link
          to="/client/login"
          className="link-success"
        >
          Sign In to Client Portal →
        </Link>
      </div>
    </div>
  );
}