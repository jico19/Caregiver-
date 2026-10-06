import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import PortalShell from '../components/sidebar/PortalShell';
import { isAdmin } from '../lib/roles';

export default function CaregiverLayout({ children }) {
  const { user, token, loading, logout } = useAuth();
  const { data: notifications } = useFetch('/caregivers/me/notifications', { enabled: !!token, defaultData: [] });
  const list = notifications?.notifications || (Array.isArray(notifications) ? notifications : []);
  const unreadCount = list.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading Caregiver Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/caregiver/login" replace />;
  if (isAdmin(user)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;

  const navLinks = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', to: '/caregiver/dashboard', icon: 'dashboard' },
      ],
    },
    {
      label: 'Care Delivery',
      items: [
        { label: 'My Clients', to: '/caregiver/clients', icon: 'clients' },
      ],
    },
    {
      label: 'Onboarding',
      items: [
        { label: 'Application', to: '/caregiver/application', icon: 'application' },
      ],
    },
    {
      label: 'Compliance',
      items: [
        { label: 'Credentials', to: '/caregiver/documents', icon: 'credentials' },
        { label: 'Training', to: '/caregiver/training', icon: 'training' },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Profile', to: '/caregiver/profile', icon: 'profile' },
        { label: 'Notifications', to: '/caregiver/notifications', icon: 'notifications', hasBadge: true, badgeCount: unreadCount },
      ],
    },
  ];

  return (
    <PortalShell
      roleBadge="Caregiver"
      homePath="/caregiver/dashboard"
      navLinks={navLinks}
      user={user}
      logout={logout}
      unreadCount={unreadCount}
      notificationsPath="/caregiver/notifications"
    >
      {children}
    </PortalShell>
  );
}
