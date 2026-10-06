import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import { admissionPacketUrl, STATE_PACKET_CODE } from '../../../shared/utils/packets';

const CLIENT_STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  active: 'Service Active',
  discharged: 'Discharged',
  rejected: 'Admission Rejected',
};

export default function DashboardPage() {
  const { token, user } = useAuth();

  const { data: profileRes, isLoading: profileLoading } = useFetch('/clients/me', { enabled: !!token });
  const { data: authRes, isLoading: authLoading } = useFetch('/clients/me/authorizations', { enabled: !!token, defaultData: [] });
  const { data: docStatusRes, isLoading: docStatusLoading } = useFetch('/clients/me/document-status', { enabled: !!token });
  const { data: schedRes, isLoading: schedLoading } = useFetch('/clients/me/schedule', { enabled: !!token });
  const { data: planRes, isLoading: planLoading } = useFetch('/clients/me/care-plan', { enabled: !!token });
  const { data: agreeRes, isLoading: agreeLoading } = useFetch('/clients/me/agreements', { enabled: !!token });
  const { data: notifyRes, isLoading: notifyLoading } = useFetch('/clients/me/notifications', { enabled: !!token });

  const profile = profileRes?.profile || null;
  const authorizations = authRes?.authorizations || [];
  const schedule = schedRes?.schedule || [];
  const carePlan = planRes?.care_plan || null;
  const agreements = agreeRes?.agreements || [];
  const notifications = notifyRes?.notifications || [];

  if (profileLoading || authLoading || docStatusLoading || schedLoading || planLoading || agreeLoading || notifyLoading) {
    return (
      <LoadingState
        title="Loading Client Care Portal..."
        subtitle="Retrieving care schedule, authorizations, and active plan of care..."
        variant="page"
      />
    );
  }

  const isIntakeComplete = Boolean(profile?.first_name && profile?.last_name);
  const stateName = profile?.states?.name || (user?.state_id === 1 ? 'Florida' : user?.state_id === 2 ? 'Indiana' : 'Georgia');
  const stateCode = profile?.states?.code || STATE_PACKET_CODE[user?.state_id] || 'FL';

  const activeAuths = authorizations.filter((a) => a.status === 'active');
  const expiringAuths = authorizations.filter((a) => a.status === 'expiring_soon');
  const pendingAgreements = agreements.filter((a) => !a.signed);
  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <PageContainer size="wide">
      <PageHeader
        title={isIntakeComplete ? `Care for ${profile.first_name} ${profile.last_name}` : 'Client Care Dashboard'}
        subtitle={`Managed Home Care Services · ${stateName} Office`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={admissionPacketUrl(stateCode)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm text-slate-700"
            >
              Admission Packet (PDF)
            </a>
            <StatusBadge status="neutral" label={user?.email} size="sm" />
          </div>
        }
      />

      {/* Action Banner: Outstanding Agreements */}
      {pendingAgreements.length > 0 && (
        <div className="alert alert-soft alert-warning mb-6 flex justify-between items-center flex-wrap gap-3">
          <div>
            <strong className="text-xs font-semibold text-orange-950">
              Action Required: {pendingAgreements.length} Unsigned Care Agreement(s)
            </strong>
            <p className="text-xs text-orange-900 m-0 mt-0.5">
              Please sign pending agreements ({pendingAgreements.map((a) => a.title).join(', ')}) to maintain active service status.
            </p>
          </div>
          <Link to="/client/forms" className="btn btn-sm btn-primary">
            Sign Agreements Now →
          </Link>
        </div>
      )}

      {/* Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card compact>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-700">Intake Status</span>
            <StatusBadge
              status={isIntakeComplete ? 'completed' : 'pending'}
              label={isIntakeComplete ? 'Complete' : 'Pending'}
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-600 m-0 mb-3 leading-normal">
            {isIntakeComplete
              ? `Medicaid ID: ${profile.medicaid_number || 'On File'}`
              : 'Submit recipient details and Medicaid records.'}
          </p>
          <Link
            to="/client/intake"
            className="text-xs font-semibold text-green-700 hover:text-green-800 underline mt-auto"
          >
            {isIntakeComplete ? 'Review Intake →' : 'Complete Intake →'}
          </Link>
        </Card>

        <Card compact>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-700">Admission Status</span>
            <StatusBadge status={profile?.status || 'pending'} label={CLIENT_STATUS_LABELS[profile?.status]} size="xs" />
          </div>
          <p className="text-xs text-slate-600 m-0 mb-3 leading-normal">
            {profile?.service_start_date
              ? `Start Date: ${new Date(profile.service_start_date).toLocaleDateString()}`
              : 'Service start pending coordinator review.'}
          </p>
          <span className="text-xs text-slate-400 block mt-auto">
            {profile?.status === 'approved' || profile?.status === 'active'
              ? 'Admission approved.'
              : 'Awaiting agency review.'}
          </span>
        </Card>

        <Card compact>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-700">Authorizations</span>
            <StatusBadge
              status={expiringAuths.length > 0 ? 'expiring_soon' : 'active'}
              label={`${activeAuths.length} Active`}
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-600 m-0 mb-3 leading-normal">
            {expiringAuths.length > 0
              ? `${expiringAuths.length} expiring within 30 days.`
              : 'Approved hours validated by Medicaid.'}
          </p>
          <Link to="/client/authorizations" className="text-xs font-semibold text-green-700 hover:text-green-800 underline mt-auto">
            View Authorizations →
          </Link>
        </Card>

        <Card compact>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-slate-700">Notifications</span>
            <StatusBadge
              status={unreadNotifications.length > 0 ? 'warning' : 'neutral'}
              label={`${unreadNotifications.length} Unread`}
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-600 m-0 mb-3 leading-normal">
            Agency updates, shift logs, and announcements.
          </p>
          <Link to="/client/notifications" className="text-xs font-semibold text-green-700 hover:text-green-800 underline mt-auto">
            View Notifications ({notifications.length}) →
          </Link>
        </Card>
      </div>

      {/* Plan of Care & Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card
          title="Plan of Care Summary"
          actions={
            <Link to="/client/care-plan" className="text-xs font-semibold text-green-700 hover:text-green-800 underline">
              Full Plan →
            </Link>
          }
        >
          {carePlan ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-base-300 pb-2">
                <span className="text-slate-500">Primary Nurse:</span>
                <span className="font-medium text-slate-900">{carePlan.primary_nurse || 'Assigned Nurse RN'}</span>
              </div>
              <div className="flex justify-between border-b border-base-300 pb-2">
                <span className="text-slate-500">Effective Date:</span>
                <span className="font-medium text-slate-900">{carePlan.effective_date || 'Current'}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Daily Activities ({carePlan.daily_activities?.length || 0}):</span>
                {carePlan.daily_activities && carePlan.daily_activities.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-slate-800">
                    {carePlan.daily_activities.slice(0, 3).map((act, idx) => (
                      <li key={idx}>
                        <strong>{act.task}</strong> {act.frequency ? `(${act.frequency})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">No specific daily tasks assigned yet.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 m-0">
              Plan of care details are finalized following initial nurse assessment.
            </p>
          )}
        </Card>

        <Card
          title="Upcoming Service Schedule"
          actions={
            <Link to="/client/schedule" className="text-xs font-semibold text-green-700 hover:text-green-800 underline">
              Full Schedule →
            </Link>
          }
        >
          {schedule.length > 0 ? (
            <div className="space-y-2 text-xs">
              {schedule.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-base-300">
                  <div>
                    <strong className="block text-slate-900">{item.day}</strong>
                    <span className="text-slate-500">{item.service || 'Personal Care'} ({item.time})</span>
                  </div>
                  <StatusBadge status={item.status || 'active'} size="xs" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 m-0">
              No caregiver visits scheduled for the upcoming week.
            </p>
          )}
        </Card>
      </div>

      {/* Compliance Overview */}
      {docStatusRes && (
        <Card
          title="Document Compliance Status"
          actions={
            <Link to="/client/documents" className="text-xs font-semibold text-green-700 hover:text-green-800 underline">
              Manage Documents →
            </Link>
          }
          className="mb-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Missing</span>
              <strong className={`text-base font-bold ${docStatusRes.summary?.missing > 0 ? 'text-error' : 'text-green-700'}`}>
                {docStatusRes.summary?.missing || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Expired</span>
              <strong className={`text-base font-bold ${docStatusRes.summary?.expired > 0 ? 'text-error' : 'text-green-700'}`}>
                {docStatusRes.summary?.expired || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Expiring Soon</span>
              <strong className="text-base font-bold text-orange-600">
                {docStatusRes.summary?.expiring_soon || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Compliance</span>
              <StatusBadge
                status={docStatusRes.summary?.compliant ? 'completed' : 'error'}
                label={docStatusRes.summary?.compliant ? 'Compliant' : 'Action Required'}
                size="xs"
              />
            </div>
          </div>
          {docStatusRes.missing?.length > 0 && (
            <div className="alert alert-soft alert-warning mt-3 text-xs mb-0">
              Missing required document(s): {docStatusRes.missing.map((m) => m.name).join(', ')}
            </div>
          )}
        </Card>
      )}

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/client/care-plan" className="block text-decoration-none">
          <Card compact className="hover:border-slate-400 transition-colors">
            <strong className="text-xs font-semibold text-slate-900 block">Plan of Care</strong>
            <span className="text-xs text-slate-500 mt-1 block">Review activities and nurse instructions</span>
          </Card>
        </Link>
        <Link to="/client/schedule" className="block text-decoration-none">
          <Card compact className="hover:border-slate-400 transition-colors">
            <strong className="text-xs font-semibold text-slate-900 block">Service Schedule</strong>
            <span className="text-xs text-slate-500 mt-1 block">Check upcoming caregiver visit times</span>
          </Card>
        </Link>
        <Link to="/client/notifications" className="block text-decoration-none">
          <Card compact className="hover:border-slate-400 transition-colors">
            <strong className="text-xs font-semibold text-slate-900 block">Notifications</strong>
            <span className="text-xs text-slate-500 mt-1 block">Agency announcements and reminders</span>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
