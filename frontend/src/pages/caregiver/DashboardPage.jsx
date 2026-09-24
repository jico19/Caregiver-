import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import { STATUS_META, milestoneMeta, badgeClass } from '../../utils/caregiverStatus';
import { packetUrl, STATE_PACKET_CODE } from '../../utils/packets';

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [credentialStatus, setCredentialStatus] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [profRes, appRes, docRes, credRes, annRes] = await Promise.all([
          api.get('/caregivers/me', token),
          api.get('/caregivers/me/application', token),
          api.get('/caregivers/me/documents', token),
          api.get('/caregivers/me/credential-status', token),
          api.get('/caregivers/me/announcements', token),
        ]);

        if (!isMounted) return;
        setProfile(profRes?.profile || null);
        setApplication(appRes?.application || null);
        setDocuments(docRes?.documents || []);
        setCredentialStatus(credRes || null);
        setAnnouncements(annRes?.announcements || []);
      } catch (err) {
        // Handled silently for dashboard fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <LoadingState
        title="Loading Caregiver Dashboard..."
        subtitle="Retrieving onboarding profile, compliance documents, and training..."
        variant="page"
      />
    );
  }

  const stateName = profile?.states?.name || (user?.state_id === 1 ? 'Florida' : user?.state_id === 2 ? 'Indiana' : 'Georgia');
  const appStatus = application?.status || null;
  const milestone = milestoneMeta(appStatus);

  return (
    <div className="page-container">
      <div className="page-header items-start">
        <div>
          <h1 className="page-title">
            Welcome back, {profile?.first_name || user?.email?.split('@')[0]}
          </h1>
          <p className="page-subtitle">
            Caregiver Onboarding and Compliance Portal · {stateName} Office
          </p>
        </div>
        <div className="badge badge-gray badge-lg">
          Account Status: <strong className="capitalize ml-1">{user?.status || 'active'}</strong>
        </div>
      </div>

      {/* Where am I + what to do next */}
      <div className={`card mb-6 ${STATUS_META[appStatus]?.panelClass || 'banner-info'}`}>
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
          <h2 className="section-title m-0">
            {milestone.title}
          </h2>
          <span className={badgeClass(appStatus)}>
            {appStatus ? (STATUS_META[appStatus]?.label || appStatus) : 'Not Started'}
          </span>
        </div>
        <p className="text-secondary text-sm leading-normal mb-3">
          {milestone.message}
        </p>
        <Link to={milestone.nextAction.to} className="text-sm font-semibold text-primary">
          {milestone.nextAction.label}
        </Link>
      </div>

      {/* Onboarding Checklist */}
      <div className="card mb-8">
        <h2 className="section-title">
          Onboarding Progress
        </h2>

        <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
          {/* Milestone 1 */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-xs">Step 1: Application</span>
              <span className={badgeClass(appStatus)}>
                {appStatus ? (STATUS_META[appStatus]?.label || appStatus) : 'Not Started'}
              </span>
            </div>
            <p className="text-secondary text-xs mb-3 leading-normal">
              {milestone.message}
            </p>
            <Link to="/caregiver/application" className="text-sm font-medium">
              {milestone.nextAction.label}
            </Link>
          </div>

          {/* Milestone 2 */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-xs">Step 2: Credentials</span>
              <span className="badge badge-gray">
                {documents.length} Uploaded
              </span>
            </div>
            <p className="text-secondary text-xs mb-3">
              Upload required CPR, CNA/HHA certificates, and state background check records.
            </p>
            <Link to="/caregiver/documents" className="text-sm font-medium">
              Upload Documents →
            </Link>
          </div>

          {/* Milestone 3 */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-xs">Step 3: Training</span>
              <span className="badge badge-gray">
                In-Service
              </span>
            </div>
            <p className="text-secondary text-xs mb-3">
              Complete assigned courses on HIPAA, infection control, and client safety.
            </p>
            <Link to="/caregiver/training" className="text-sm font-medium">
              Go to Training →
            </Link>
          </div>
        </div>
      </div>

      {/* Credential Health Panels */}
      {credentialStatus && (
        <div className="card mb-8">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
            <h2 className="section-title m-0">
              Credential Health
            </h2>
            <Link to="/caregiver/documents" className="text-sm font-medium">
              Manage Credentials →
            </Link>
          </div>

          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
            <div className={`stat-card ${credentialStatus.summary?.expired ? 'stat-card-error' : 'stat-card-success'}`}>
              <div className="text-xs text-muted font-semibold mb-1">Expired</div>
              <div className="stat-value">{credentialStatus.summary?.expired || 0}</div>
              {credentialStatus.expired?.length > 0 && (
                <div className="text-xs text-secondary mt-1">
                  {credentialStatus.expired.map((d) => d.name).join(', ')}
                </div>
              )}
            </div>

            <div className="stat-card stat-card-warning">
              <div className="text-xs text-muted font-semibold mb-1">Expiring within 30 days</div>
              <div className="stat-value">{credentialStatus.summary?.expiring_soon || 0}</div>
              {credentialStatus.expiring_soon?.length > 0 && (
                <div className="text-xs text-secondary mt-1">
                  {credentialStatus.expiring_soon.map((d) => d.name).join(', ')}
                </div>
              )}
            </div>

            <div className="stat-card stat-card-warning">
              <div className="text-xs text-muted font-semibold mb-1">Missing documents</div>
              <div className="stat-value">{credentialStatus.summary?.missing || 0}</div>
              {credentialStatus.missing?.length > 0 && (
                <div className="text-xs text-secondary mt-1">
                  {credentialStatus.missing.slice(0, 4).map((m) => m.name).join(', ')}
                  {credentialStatus.missing.length > 4 ? '…' : ''}
                </div>
              )}
            </div>
          </div>

          {credentialStatus.summary?.compliant && (
            <p className="text-xs text-success mt-3 mb-0">
              All required credentials for your state are on file and current.
            </p>
          )}
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="card mb-8">
          <h2 className="section-title">
            Announcements
          </h2>
          <div className="flex flex-col gap-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="card p-4">
                <div className="flex justify-between items-center flex-wrap gap-2 mb-1">
                  <h3 className="font-semibold text-sm m-0">{ann.title}</h3>
                  <span className="text-xs text-muted">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-secondary text-sm leading-normal m-0">
                  {ann.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-2">Manage Your Profile</h3>
          <p className="text-secondary text-sm leading-normal mb-4">
            Update your contact telephone, home address, and licensing state details anytime.
          </p>
          <Link to="/caregiver/profile" className="text-sm font-medium">
            Edit Profile →
          </Link>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-2">In-App Notifications</h3>
          <p className="text-secondary text-sm leading-normal mb-4">
            View system alerts, approval notices, credential reminders, and training updates.
          </p>
          <Link to="/caregiver/notifications" className="text-sm font-medium">
            Check Notifications →
          </Link>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-2">Employment Packet</h3>
          <p className="text-secondary text-sm leading-normal mb-4">
            Download the printable new-hire packet with offer letter, W-4, direct deposit, handbook, and consent forms.
          </p>
          <a
            href={packetUrl(profile?.states?.code || STATE_PACKET_CODE[user?.state_id])}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium"
          >
            Get Employment Packet (PDF) →
          </a>
        </div>
      </div>
    </div>
  );
}