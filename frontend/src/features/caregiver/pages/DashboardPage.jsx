import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { STATUS_META, milestoneMeta } from '../../../shared/utils/caregiverStatus';
import { packetUrl, STATE_PACKET_CODE } from '../../../shared/utils/packets';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';

export default function DashboardPage() {
  const { token, user } = useAuth();

  const { data: profileRes, isLoading: profileLoading } = useFetch('/caregivers/me', { enabled: !!token });
  const { data: appRes, isLoading: appLoading } = useFetch('/caregivers/me/application', { enabled: !!token });
  const { data: docRes, isLoading: docsLoading } = useFetch('/caregivers/me/documents', { enabled: !!token, defaultData: [] });
  const { data: credentialStatus, isLoading: credLoading } = useFetch('/caregivers/me/credential-status', { enabled: !!token });
  const { data: annRes, isLoading: annLoading } = useFetch('/caregivers/me/announcements', { enabled: !!token, defaultData: [] });
  const { data: trainingRes, isLoading: trainingLoading } = useFetch('/training/courses', { enabled: !!token });

  const profile = profileRes?.profile || null;
  const application = appRes?.application || null;
  const documents = docRes?.documents || [];
  const announcements = annRes?.announcements || [];
  const courses = trainingRes?.courses || [];
  const completedTrainingCount = courses.filter((c) => c.enrollment_status === 'completed').length;

  const loading = profileLoading || appLoading || docsLoading || credLoading || annLoading || trainingLoading;

  if (loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading caregiver dashboard...
        </div>
      </PageContainer>
    );
  }

  const stateName = profile?.states?.name || (user?.state_id === 1 ? 'Florida' : user?.state_id === 2 ? 'Indiana' : 'Georgia');
  const appStatus = application?.status || null;
  const milestone = milestoneMeta(appStatus);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${profile?.first_name || user?.email?.split('@')[0]}`}
        subtitle={`Caregiver Onboarding and Compliance Portal · ${stateName} Office`}
        actions={
          <span className="badge badge-soft text-slate-700 text-xs capitalize">
            Account: {user?.status || 'active'}
          </span>
        }
      />

      {/* Primary Next Action Banner */}
      <Card className="mb-6 border-emerald-200 bg-emerald-50/20">
        <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
          <h2 className="font-semibold text-base text-slate-900 m-0">
            {milestone.title}
          </h2>
          <StatusBadge
            status={appStatus || 'not_started'}
            label={appStatus ? (STATUS_META[appStatus]?.label || appStatus) : 'Not Started'}
          />
        </div>
        <p className="text-slate-600 text-sm leading-normal mb-3">
          {milestone.message}
        </p>
        <Link
          to={milestone.nextAction.to}
          className="btn btn-primary btn-sm inline-flex items-center"
        >
          {milestone.nextAction.label}
        </Link>
      </Card>

      {/* Onboarding Progress */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">
          Onboarding Progress
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1: Application */}
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-900">Step 1: Application</span>
                <StatusBadge
                  status={appStatus || 'not_started'}
                  label={appStatus ? (STATUS_META[appStatus]?.label || appStatus) : 'Not Started'}
                />
              </div>
              <p className="text-slate-600 text-xs mb-3 leading-normal">
                {appStatus ? 'Application details on file and under review.' : 'Complete candidate details and electronic signature.'}
              </p>
            </div>
            <Link
              to="/caregiver/application"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {appStatus ? 'View Application →' : 'Start Application →'}
            </Link>
          </Card>

          {/* Step 2: Credentials */}
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-900">Step 2: Credentials</span>
                <span className="badge badge-soft text-slate-700 text-xs">
                  {documents.length} Uploaded
                </span>
              </div>
              <p className="text-slate-600 text-xs mb-3 leading-normal">
                Upload required CPR, CNA/HHA certificates, and state background check records.
              </p>
            </div>
            <Link
              to="/caregiver/documents"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Upload Documents →
            </Link>
          </Card>

          {/* Step 3: Training */}
          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-900">Step 3: Training</span>
                <span className="badge badge-soft text-slate-700 text-xs">
                  {completedTrainingCount} / {courses.length} Completed
                </span>
              </div>
              <p className="text-slate-600 text-xs mb-3 leading-normal">
                Complete assigned courses on HIPAA, infection control, and client safety.
              </p>
            </div>
            <Link
              to="/caregiver/training"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Go to Training →
            </Link>
          </Card>
        </div>
      </div>

      {/* Credential Health Panels */}
      {credentialStatus && (
        <Card className="mb-6">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
            <h2 className="font-semibold text-base text-slate-900 m-0">
              Credential Health
            </h2>
            <Link
              to="/caregiver/documents"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Manage Credentials →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded border ${credentialStatus.summary?.expired ? 'bg-red-50/50 border-red-200' : 'bg-base-200/50 border-base-300'}`}>
              <div className="text-xs text-slate-500 font-medium mb-1">Expired</div>
              <div className="text-2xl font-bold text-slate-900">{credentialStatus.summary?.expired || 0}</div>
              {credentialStatus.expired?.length > 0 && (
                <div className="text-xs text-slate-600 mt-1">
                  {credentialStatus.expired.map((d) => d.name).join(', ')}
                </div>
              )}
            </div>

            <div className="p-4 rounded border bg-base-200/50 border-base-300">
              <div className="text-xs text-slate-500 font-medium mb-1">Expiring within 30 days</div>
              <div className="text-2xl font-bold text-slate-900">{credentialStatus.summary?.expiring_soon || 0}</div>
              {credentialStatus.expiring_soon?.length > 0 && (
                <div className="text-xs text-slate-600 mt-1">
                  {credentialStatus.expiring_soon.map((d) => d.name).join(', ')}
                </div>
              )}
            </div>

            <div className="p-4 rounded border bg-base-200/50 border-base-300">
              <div className="text-xs text-slate-500 font-medium mb-1">Missing documents</div>
              <div className="text-2xl font-bold text-slate-900">{credentialStatus.summary?.missing || 0}</div>
              {credentialStatus.missing?.length > 0 && (
                <div className="text-xs text-slate-600 mt-1">
                  {credentialStatus.missing.slice(0, 4).map((m) => m.name).join(', ')}
                  {credentialStatus.missing.length > 4 ? '…' : ''}
                </div>
              )}
            </div>
          </div>

          {credentialStatus.summary?.compliant && (
            <p className="text-xs text-emerald-700 font-medium mt-3 mb-0">
              ✓ All required credentials for your state are on file and current.
            </p>
          )}
        </Card>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card className="mb-6">
          <h2 className="font-semibold text-base text-slate-900 m-0 mb-3">
            Announcements
          </h2>
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-3.5 rounded border border-base-300 bg-base-100">
                <div className="flex justify-between items-center flex-wrap gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-slate-900 m-0">{ann.title}</h3>
                  <span className="text-xs text-slate-400">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-normal m-0">
                  {ann.body}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-1">Manage Profile</h3>
            <p className="text-slate-600 text-xs leading-normal mb-3">
              Update your contact telephone, home address, and licensing state details anytime.
            </p>
          </div>
          <Link to="/caregiver/profile" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Edit Profile →
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-1">In-App Notifications</h3>
            <p className="text-slate-600 text-xs leading-normal mb-3">
              View system alerts, approval notices, credential reminders, and training updates.
            </p>
          </div>
          <Link to="/caregiver/notifications" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Check Notifications →
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-1">Employment Packet</h3>
            <p className="text-slate-600 text-xs leading-normal mb-3">
              Download the printable new-hire packet with offer letter, W-4, direct deposit, and handbook.
            </p>
          </div>
          <a
            href={packetUrl(profile?.states?.code || STATE_PACKET_CODE[user?.state_id])}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Get Employment Packet (PDF) →
          </a>
        </Card>
      </div>
    </PageContainer>
  );
}
