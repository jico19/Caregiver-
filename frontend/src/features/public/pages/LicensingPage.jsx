import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';

export default function LicensingPage() {
  const { state = 'florida' } = useParams();
  const { data, isLoading: loading, error: errorMsg } = useFetch(`/states/${state}/licensing`, { defaultData: [] });

  const licensing = data?.licensing || [];
  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={
          <Link to={`/${state}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            ← Back to {stateName} Office
          </Link>
        }
        title={`State Licensing & Accreditation: ${stateName}`}
        subtitle="Full disclosure of agency operating certificates, Medicaid provider authorizations, and clinical compliance standards."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
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
        <EmptyState
          title={`Licensing records are being updated for ${stateName}`}
          description="Official provider licenses and regulatory disclosure documents are available upon request from the regional office."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {licensing.map((item) => (
            <Card key={item.id}>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status="active" label="Active Certification" size="xs" />
                <h2 className="text-sm font-semibold text-slate-900 m-0">
                  {item.title}
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-normal m-0">
                {item.body}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card
        className="mt-8 bg-slate-50"
        title="Continuous Clinical Compliance"
        subtitle={`All agency caregivers in ${stateName} undergo statewide Level 2 fingerprint background screening, annual TB testing, drug screening, and ongoing mandatory in-service education under registered nurse supervision.`}
      />
    </PageContainer>
  );
}