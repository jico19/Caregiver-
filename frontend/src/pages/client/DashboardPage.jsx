import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadClientDashboard() {
      try {
        const [profRes, authRes] = await Promise.all([
          api.get('/clients/me', token),
          api.get('/clients/me/authorizations', token),
        ]);

        if (!isMounted) return;
        setProfile(profRes?.profile || null);
        setAuthorizations(authRes?.authorizations || []);
      } catch (err) {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadClientDashboard();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
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
        <div className="badge badge-green badge-lg">
          Account: <strong className="capitalize ml-1">{user?.email}</strong>
        </div>
      </div>

      {/* Status Highlights */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
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
              ? `Registered under Medicaid ID: ${profile.medicaid_number || 'On File'}`
              : 'Submit primary care recipient information and Medicaid records to begin.'}
          </p>
          <Link
            to="/client/intake"
            className={`link-stat ${isIntakeComplete ? 'link-stat-complete' : 'link-stat-pending'}`}
          >
            {isIntakeComplete ? 'Review / Update Intake Details →' : 'Complete Intake Form Now →'}
          </Link>
        </div>

        {/* Authorizations Overview */}
        <div className="stat-box stat-box-white">
          <div className="stat-box-head">
            <span className="stat-box-label">Service Authorizations</span>
            <span className="stat-status stat-status-blue">
              {authorizations.length} Active
            </span>
          </div>
          <p className="stat-box-text">
            Approved hours and service dates validated by state Medicaid coordinators.
          </p>
          <Link to="/client/authorizations" className="link-stat link-stat-plain">
            View Authorization Records →
          </Link>
        </div>

        {/* Documents Overview */}
        <div className="stat-box stat-box-white">
          <div className="stat-box-head">
            <span className="stat-box-label">Care Documents</span>
            <span className="stat-status stat-status-gray">Records</span>
          </div>
          <p className="stat-box-text">
            Physician orders, plan of care, and signed client agreement files.
          </p>
          <Link to="/client/documents" className="link-stat link-stat-plain">
            Manage Documents →
          </Link>
        </div>
      </div>

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