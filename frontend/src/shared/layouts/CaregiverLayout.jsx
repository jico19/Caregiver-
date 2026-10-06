import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import PortalNavbar from '../components/common/PortalNavbar';
import { isAdmin } from '../lib/roles';

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
  if (isAdmin(user)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;

  // The brand links to the dashboard, which is why it is not repeated here.
  const navLinks = [
    { label: 'My Clients', to: '/caregiver/clients' },
    { label: 'Application', to: '/caregiver/application' },
    {
      label: 'Compliance',
      items: [
        { label: 'Credentials', to: '/caregiver/documents' },
        { label: 'Training', to: '/caregiver/training' },
      ],
    },
    { label: 'Profile', to: '/caregiver/profile' },
    { label: 'Notifications', to: '/caregiver/notifications', hasBadge: true, badgeCount: unreadCount },
  ];

  return (
    <div className="portal-shell">
      <PortalNavbar
        roleBadge="Caregiver"
        roleBadgeColor={{
          bg: 'var(--primary-light)',
          text: 'var(--primary)',
          border: 'var(--color-primary-border)',
        }}
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
