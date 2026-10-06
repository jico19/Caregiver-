import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function FormsPage() {
  const { state = 'florida' } = useParams();
  const { data, isLoading: loading, error: errorMsg } = useFetch(`/states/${state}/forms`, { defaultData: [] });

  const forms = data?.forms || [];
  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={
          <Link to={`/${state}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            ← Back to {stateName} Office
          </Link>
        }
        title={`${stateName} Client & Regulatory Forms`}
        subtitle="Download state-mandated disclosures, Medicaid intake authorization packets, and client rights documentation."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
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
        <EmptyState
          title={`No downloadable forms currently listed for ${stateName}`}
          description="Please contact our regional office directly for specialized document packets and disclosures."
          action={
            <Link to={`/${state}/contact`} className="btn btn-sm btn-outline text-slate-700">
              Contact Regional Office
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {forms.map((f) => (
            <Card key={f.id}>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-sm font-semibold text-slate-900 m-0">
                    {f.name}
                  </h2>
                  <p className="text-xs text-slate-600 leading-normal mt-1 mb-0">
                    {f.description}
                  </p>
                </div>

                <div>
                  <a
                    href={f.file_url || '#'}
                    download
                    onClick={(e) => {
                      if (f.file_url === '#') {
                        e.preventDefault();
                        alert('This official packet is issued directly upon intake initiation.');
                      }
                    }}
                    className="btn btn-outline btn-sm text-slate-700"
                  >
                    Download Form ↓
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card
        className="mt-8"
        title="Need to submit completed documents?"
        subtitle="You can securely upload signed physician orders and insurance documents directly through the client portal."
      >
        <div className="mt-2">
          <Link
            to="/client/login"
            className="text-xs font-semibold text-green-700 hover:text-green-800 underline"
          >
            Sign In to Client Portal →
          </Link>
        </div>
      </Card>
    </PageContainer>
  );
}