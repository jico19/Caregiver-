import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import PortalShell from '../components/sidebar/PortalShell';
import { isAdmin } from '../lib/roles';

export default function ClientLayout() {
  const { user, token, loading, logout } = useAuth();
  const { data: notifications } = useFetch('/clients/me/notifications', { enabled: !!token, defaultData: [] });
  const list = notifications?.notifications || (Array.isArray(notifications) ? notifications : []);
  const unreadCount = list.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading Client Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/client/login" replace />;
  if (isAdmin(user)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;

  const navLinks = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', to: '/client/dashboard', icon: 'dashboard' },
      ],
    },
    {
      label: 'My Care',
      items: [
        { label: 'Care Plan', to: '/client/care-plan', icon: 'carePlan' },
        { label: 'Schedule', to: '/client/schedule', icon: 'schedule' },
      ],
    },
    {
      label: 'Documents & Records',
      items: [
        { label: 'Intake', to: '/client/intake', icon: 'intake' },
        { label: 'Forms', to: '/client/forms', icon: 'forms' },
        { label: 'Records', to: '/client/documents', icon: 'records' },
        { label: 'Authorizations', to: '/client/authorizations', icon: 'authorizations' },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Profile', to: '/client/profile', icon: 'profile' },
        { label: 'Alerts', to: '/client/notifications', icon: 'alerts', hasBadge: true, badgeCount: unreadCount },
      ],
    },
  ];

  return (
    <PortalShell
      roleBadge="Client & Family"
      homePath="/client/dashboard"
      navLinks={navLinks}
      user={user}
      logout={logout}
      unreadCount={unreadCount}
      notificationsPath="/client/notifications"
    />
  );
}
