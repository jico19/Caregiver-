import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useFetch from '../hooks/useFetch';
import PortalNavbar from '../components/common/PortalNavbar';

export default function CaregiverLayout({ children }) {
  const { user, token, loading, logout } = useAuth();
  const { data: notifications } = useFetch('/caregivers/me/notifications', { enabled: !!token, defaultData: [] });
  const list = notifications?.notifications || (Array.isArray(notifications) ? notifications : []);
  const unreadCount = list.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="loading-screen">
        Loading Caregiver Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/caregiver/login" replace />;
  if (user.role === 'administrator') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;

  const navLinks = [
    { label: 'Dashboard', to: '/caregiver/dashboard' },
    { label: 'Application', to: '/caregiver/application' },
    { label: 'Credentials', to: '/caregiver/documents' },
    { label: 'Training', to: '/caregiver/training' },
    { label: 'Profile', to: '/caregiver/profile' },
    { label: 'Notifications', to: '/caregiver/notifications', hasBadge: true, badgeCount: unreadCount },
  ];

  return (
    <div className="portal-shell">
      <PortalNavbar
        roleBadge="Caregiver"
        roleBadgeColor={{ bg: 'var(--primary-light)', text: 'var(--primary)', border: '#bfdbfe' }}
        homePath="/caregiver/dashboard"
        navLinks={navLinks}
        user={user}
        logout={logout}
        accentColor="blue"
      />
      <main>{children ?? <Outlet />}</main>
    </div>
  );
}
