import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import LoadingState from '../../../shared/components/common/LoadingState';
import { admissionPacketUrl, STATE_PACKET_CODE } from '../../../shared/utils/packets';

const CLIENT_STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  active: 'Service Active',
  discharged: 'Discharged',
  rejected: 'Admission Rejected',
};

const CLIENT_STATUS_BADGE = {
  pending: 'stat-status-pending',
  approved: 'stat-status-blue',
  active: 'stat-status-complete',
  discharged: 'stat-status-gray',
  rejected: 'stat-status-pending',
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

  // Authorization counts (filtered by status)
  const activeAuths = authorizations.filter((a) => a.status === 'active');
  const expiringAuths = authorizations.filter((a) => a.status === 'expiring_soon');
  const pendingAgreements = agreements.filter((a) => !a.signed);
  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <div className="container-wide">
      <div className="page-header items-start">
        <div>
          <h1 className="page-title">
            {isIntakeComplete ? `Care for ${profile.first_name} ${profile.last_name}` : 'Client Care Dashboard'}
          </h1>
          <p className="page-subtitle">
            Managed Home Care Services · {stateName} Office
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={admissionPacketUrl(stateCode)}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-secondary"
          >
            Download Admission Packet
          </a>
          <div className="badge badge-green badge-lg">
            Account: <strong className="capitalize ml-1">{user?.email}</strong>
          </div>
        </div>
      </div>

      {/* Action Banner: Outstanding Agreements */}
      {pendingAgreements.length > 0 && (
        <div className="alert alert-warning mb-6 flex justify-between items-center flex-wrap gap-3">
          <div>
            <strong>Action Required: {pendingAgreements.length} Unsigned Care Agreement(s)</strong>
            <p className="text-xs m-0 mt-0.5">
              Please sign pending agreements ({pendingAgreements.map((a) => a.title).join(', ')}) to maintain active service status.
            </p>
          </div>
          <Link to="/client/agreements" className="btn btn-sm btn-primary">
            Sign Agreements Now →
          </Link>
        </div>
      )}

      {/* Status Highlights */}
      <div className="grid grid-cols-4 max-md:grid-cols-1 gap-4 mb-8">
        {/* Intake Status */}
        <div className={`stat-box ${isIntakeComplete ? 'stat-box-complete' : 'stat-box-pending'}`}>
          <div className="stat-box-head">
            <span className="stat-box-label">Intake Status</span>
            <span className={`stat-status ${isIntakeComplete ? 'stat-status-complete' : 'stat-status-pending'}`}>
              {isIntakeComplete ? 'Complete' : 'Pending Intake'}
            </span>
          </div>
          <p className="stat-box-text">
            {isIntakeComplete
              ? `Medicaid ID: ${profile.medicaid_number || 'On File'}`
              : 'Submit primary care recipient information and Medicaid records to begin.'}
          </p>
          <Link
            to="/client/intake"
            className={`link-stat ${isIntakeComplete ? 'link-stat-complete' : 'link-stat-pending'}`}
          >
            {isIntakeComplete ? 'Review / Update Intake →' : 'Complete Intake Form Now →'}
          </Link>
        </div>

        {/* Admission Status & Start Date */}
        <div className={`stat-box ${profile?.status === 'active' || profile?.status === 'approved' ? 'stat-box-complete' : 'stat-box-white'}`}>
          <div className="stat-box-head">
            <span className="stat-box-label">Admission Status</span>
            <span className={`stat-status ${CLIENT_STATUS_BADGE[profile?.status] || 'stat-status-pending'}`}>
              {CLIENT_STATUS_LABELS[profile?.status] || profile?.status || 'Pending'}
            </span>
          </div>
          <p className="stat-box-text">
            {profile?.service_start_date
              ? `Confirmed Start Date: ${new Date(profile.service_start_date).toLocaleDateString()}`
              : 'Service start date pending coordinator review.'}
          </p>
          <span className="text-xs text-secondary block mt-1">
            {profile?.status === 'approved' || profile?.status === 'active'
              ? 'Admission approved by agency.'
              : 'Awaiting agency admission review.'}
          </span>
        </div>

        {/* Authorizations Overview - Filtered Active vs Expiring */}
        <div className="stat-box stat-box-white">
          <div className="stat-box-head">
            <span className="stat-box-label">Service Authorizations</span>
            <span className={`stat-status ${expiringAuths.length > 0 ? 'stat-status-pending' : 'stat-status-blue'}`}>
              {activeAuths.length} Active {expiringAuths.length > 0 ? `(${expiringAuths.length} Expiring Soon)` : ''}
            </span>
          </div>
          <p className="stat-box-text">
            {expiringAuths.length > 0
              ? `${expiringAuths.length} authorization(s) expiring within 30 days.`
              : 'Approved hours and service dates validated by state Medicaid.'}
          </p>
          <Link to="/client/authorizations" className="link-stat link-stat-plain">
            View Authorization Records →
          </Link>
        </div>

        {/* Notifications & Documents */}
        <div className="stat-box stat-box-white">
          <div className="stat-box-head">
            <span className="stat-box-label">Notifications</span>
            <span className={`stat-status ${unreadNotifications.length > 0 ? 'stat-status-pending' : 'stat-status-gray'}`}>
              {unreadNotifications.length} Unread
            </span>
          </div>
          <p className="stat-box-text">
            Agency updates, scheduling changes, and care announcements.
          </p>
          <Link to="/client/notifications" className="link-stat link-stat-plain">
            View Notifications ({notifications.length}) →
          </Link>
        </div>
      </div>

      {/* Plan of Care & Schedule Live Cards */}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 mb-8">
        {/* Care Plan Summary */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-title m-0">Plan of Care Summary</h2>
            <Link to="/client/care-plan" className="text-xs font-semibold text-primary">
              Full Plan →
            </Link>
          </div>
          {carePlan ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-secondary">Primary Nurse:</span>
                <span className="font-medium text-ink">{carePlan.primary_nurse || 'Assigned Nurse RN'}</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-secondary">Effective Date:</span>
                <span className="font-medium text-ink">{carePlan.effective_date || 'Current'}</span>
              </div>
              <div className="pt-1">
                <span className="text-secondary block mb-1">Daily Care Activities ({carePlan.daily_activities?.length || 0}):</span>
                {carePlan.daily_activities && carePlan.daily_activities.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-ink">
                    {carePlan.daily_activities.slice(0, 3).map((act, idx) => (
                      <li key={idx}>
                        <strong>{act.task}</strong> {act.frequency ? `(${act.frequency})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">No specific daily tasks assigned yet.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-secondary m-0">
              Plan of care details are finalized following initial nurse assessment.
            </p>
          )}
        </div>

        {/* Schedule Summary */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h2 className="section-title m-0">Upcoming Service Schedule</h2>
            <Link to="/client/schedule" className="text-xs font-semibold text-primary">
              Full Schedule →
            </Link>
          </div>
          {schedule.length > 0 ? (
            <div className="space-y-2 text-xs">
              {schedule.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded bg-subtle">
                  <div>
                    <strong className="block text-ink">{item.day}</strong>
                    <span className="text-secondary">{item.service || 'Personal Care'} ({item.time})</span>
                  </div>
                  <span className="badge badge-green text-[10px]">{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-secondary m-0">
              No caregiver visits scheduled for the upcoming week.
            </p>
          )}
        </div>
      </div>

      {/* Required Client Documents */}
      {docStatusRes && (
        <div className="card mb-8">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
            <h2 className="section-title m-0">
              Document Compliance Status
            </h2>
            <Link to="/client/documents" className="text-sm font-medium">
              Manage Documents →
            </Link>
          </div>
          <div className="grid grid-cols-4 max-md:grid-cols-1 gap-3">
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Missing Documents</span>
              <strong className={`text-lg ${docStatusRes.summary?.missing > 0 ? 'text-red' : 'text-green'}`}>
                {docStatusRes.summary?.missing || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Expired</span>
              <strong className={`text-lg ${docStatusRes.summary?.expired > 0 ? 'text-red' : 'text-green'}`}>
                {docStatusRes.summary?.expired || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Expiring Soon</span>
              <strong className="text-lg text-yellow">
                {docStatusRes.summary?.expiring_soon || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Compliance Status</span>
              <strong className={`text-sm ${docStatusRes.summary?.compliant ? 'text-green' : 'text-red'}`}>
                {docStatusRes.summary?.compliant ? 'Compliant' : 'Action Required'}
              </strong>
            </div>
          </div>
          {docStatusRes.missing?.length > 0 && (
            <div className="alert alert-warning mt-3 text-sm mb-0">
              Missing required document(s): {docStatusRes.missing.map((m) => m.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
        <Link
          to="/client/care-plan"
          className="quick-link"
        >
          <strong className="quick-link-title">Plan of Care</strong>
          <span className="quick-link-desc">Review daily activities and nurse instructions</span>
        </Link>

        <Link
          to="/client/schedule"
          className="quick-link"
        >
          <strong className="quick-link-title">Service Schedule</strong>
          <span className="quick-link-desc">Check upcoming caregiver visit times</span>
        </Link>

        <Link
          to="/client/notifications"
          className="quick-link"
        >
          <strong className="quick-link-title">Notifications</strong>
          <span className="quick-link-desc">Agency announcements and visit reminders</span>
        </Link>
      </div>
    </div>
  );
}
