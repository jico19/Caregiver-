import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useFetch from '../hooks/useFetch';
import PortalNavbar from '../components/common/PortalNavbar';

export default function ClientLayout() {
  const { user, token, loading, logout } = useAuth();
  const { data: notifications } = useFetch('/clients/me/notifications', { enabled: !!token, defaultData: [] });
  const list = notifications?.notifications || (Array.isArray(notifications) ? notifications : []);
  const unreadCount = list.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="loading-screen">
        Loading Client Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/client/login" replace />;
  if (user.role === 'administrator') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;

  const navLinks = [
    { label: 'Dashboard', to: '/client/dashboard' },
    { label: 'Intake', to: '/client/intake' },
    { label: 'Forms', to: '/client/forms' },
    { label: 'Records', to: '/client/documents' },
    { label: 'Authorizations', to: '/client/authorizations' },
    { label: 'Care Plan', to: '/client/care-plan' },
    { label: 'Schedule', to: '/client/schedule' },
    { label: 'Profile', to: '/client/profile' },
    { label: 'Alerts', to: '/client/notifications', hasBadge: true, badgeCount: unreadCount },
  ];

  return (
    <div className="portal-shell">
      <PortalNavbar
        roleBadge="Client & Family"
        roleBadgeColor={{ bg: 'var(--success-light)', text: 'var(--success)', border: '#a7f3d0' }}
        homePath="/client/dashboard"
        navLinks={navLinks}
        user={user} logout={logout} accentColor="emerald"
      />
      <main><Outlet /></main>
    </div>
  );
}
