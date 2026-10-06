import { useParams, Link } from 'react-router-dom';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import { packetUrl } from '../../../shared/utils/packets';

export default function CareersPage() {
  const { state = 'florida' } = useParams();
  const { data, isLoading: loading, error: errorMsg } = useFetch(`/states/${state}/careers`, { defaultData: [] });

  const careers = data?.careers || [];
  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={
          <Link to={`/${state}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            ← Back to {stateName} Office
          </Link>
        }
        title={`Caregiver Careers in ${stateName}`}
        subtitle="Join our accredited home care clinical team. We offer competitive weekly pay, flexible scheduling, paid in-service training, and comprehensive career development."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/caregiver/application?state=${state}`}
              className="btn btn-primary btn-sm"
            >
              Apply Online Now
            </Link>
            <a
              href={packetUrl(state)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm text-slate-700"
            >
              Download Packet (PDF)
            </a>
          </div>
        }
      />

      {loading && (
        <LoadingState
          title={`Loading Career Openings in ${stateName}...`}
          subtitle={`Fetching job listings and wage rates for ${stateName}...`}
          variant="cards"
          count={3}
        />
      )}

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}

      {!loading && !errorMsg && careers.length === 0 && (
        <EmptyState
          title={`No current public openings in ${stateName}`}
          description="We review candidate profiles continuously. Submit your general caregiver application and credential portfolio to be contacted for upcoming shifts."
          action={
            <Link
              to={`/caregiver/application?state=${state}`}
              className="btn btn-primary btn-sm"
            >
              Submit General Application
            </Link>
          }
        />
      )}

      {!loading && !errorMsg && careers.length > 0 && (
        <div className="flex flex-col gap-4">
          {careers.map((job) => (
            <Card key={job.id}>
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 m-0">
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-green-700">
                      {job.compensation}
                    </span>
                    <span className="text-slate-300">·</span>
                    <StatusBadge status={job.job_type || 'full_time'} label={job.job_type} size="xs" />
                  </div>
                </div>

                <Link
                  to={`/caregiver/application?state=${state}&job=${encodeURIComponent(job.title)}`}
                  className="btn btn-primary btn-sm"
                >
                  Apply Now →
                </Link>
              </div>

              {job.description && (
                <p className="text-xs text-slate-600 leading-normal my-2">
                  {job.description}
                </p>
              )}

              {job.requirements && (
                <div className="p-3 bg-slate-50 border border-base-300 rounded-md text-xs text-slate-700 mt-2">
                  <strong className="font-semibold text-slate-800">Requirements:</strong> {job.requirements}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}