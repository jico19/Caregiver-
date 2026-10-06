import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { formatBusinessDaysAgo } from '../../../shared/utils/businessDays';
import { STATUS_META, milestoneMeta } from '../../../shared/utils/caregiverStatus';
import { packetUrl, STATE_PACKET_CODE } from '../../../shared/utils/packets';
import { getStateName } from '../constants/applicationConstants';
import { useCaregiverApplication } from '../hooks/useCaregiverApplication';
import ApplicationSuccessScreen from '../components/application/ApplicationSuccessScreen';
import ApplicationRoadmapCard from '../components/application/ApplicationRoadmapCard';
import ApplicationSummaryCard from '../components/application/ApplicationSummaryCard';
import ApplicationFormFields from '../components/application/ApplicationFormFields';

export default function ApplicationPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const app = useCaregiverApplication(auth);

  if (app.loading) {
    return <div className="loading-screen">Loading application details...</div>;
  }

  const appStatus = app.application?.status || null;
  const meta = (appStatus && STATUS_META[appStatus]) || STATUS_META.draft;
  const formLocked = !!(app.application && meta.locked);
  const isRejected = appStatus === 'rejected';
  const submittedAt = app.application?.submitted_at || app.application?.created_at || null;
  const daysAgoText = formatBusinessDaysAgo(submittedAt);
  const rejectionReason = isRejected && (app.application?.rejection_reason || app.application?.notes)
    ? (app.application.rejection_reason || app.application.notes)
    : null;
  const milestone = milestoneMeta(appStatus);

  const values = app.watch();
  const firstName = values.first_name || '';
  const lastName = values.last_name || '';
  const stateId = values.state_id;
  const signatureValue = values.signature_data;

  if (app.isSuccessSubmitted) {
    return (
      <ApplicationSuccessScreen
        successMode={app.successMode}
        onNavigateDashboard={() => navigate('/caregiver/dashboard')}
        onNavigateDocuments={() => navigate('/caregiver/documents')}
      />
    );
  }

  return (
    <div className="container-medium">
      {/* Top Banner & Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="badge badge-info">
              Direct Candidate Onboarding
            </span>
            <span className="text-xs text-secondary font-semibold">
              Florida • Indiana • Georgia
            </span>
          </div>

          {!auth.user && (
            <Link to="/caregiver/login" className="text-sm font-semibold text-primary">
              Already registered? Sign In →
            </Link>
          )}

          {auth.user && (
            <a
              href={packetUrl(STATE_PACKET_CODE[stateId])}
              target="_blank"
              rel="noreferrer"
              className="btn-outline-secondary btn-sm"
            >
              Download Employment Packet (PDF)
            </a>
          )}
        </div>

        <h1 className="page-title">
          Caregiver Employment Application
        </h1>
        <p className="page-subtitle">
          Apply to provide state-licensed home care services. Fill out your candidate details below — no preliminary registration required.
        </p>
      </div>

      {app.errorMsg && (
        <div role="alert" className="alert alert-error">
          {app.errorMsg}
        </div>
      )}

      {app.successMsg && (
        <div role="status" className="alert alert-success">
          {app.successMsg}
        </div>
      )}

      <ApplicationRoadmapCard
        appStatus={appStatus}
        meta={meta}
        milestone={milestone}
        rejectionReason={rejectionReason}
        submittedAt={submittedAt}
        daysAgoText={daysAgoText}
      />

      {formLocked ? (
        <ApplicationSummaryCard
          firstName={firstName}
          lastName={lastName}
          phone={values.phone}
          stateName={getStateName(stateId)}
          submittedAt={submittedAt}
          notes={values.notes}
          milestone={milestone}
        />
      ) : (
        <ApplicationFormFields
          user={auth.user}
          register={app.register}
          control={app.control}
          errors={app.errors}
          isSubmitting={app.isSubmitting}
          isRejected={isRejected}
          signatureValue={signatureValue}
          draftSavedAt={app.draftSavedAt}
          onClearDraft={app.handleClearDraft}
          onSubmit={app.submitHandler}
        />
      )}
    </div>
  );
}