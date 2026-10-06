import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import PortalShell from '../components/sidebar/PortalShell';
import { isAdmin } from '../lib/roles';

export default function AdminLayout() {
  const { user, token, loading, logout } = useAuth();
  const { data: notifications } = useFetch('/admin/notifications', { enabled: !!token, defaultData: [] });
  const list = notifications?.notifications || (Array.isArray(notifications) ? notifications : []);
  const unreadCount = list.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading Admin Operations Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/caregiver/login" replace />;
  if (user.role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;
  if (!isAdmin(user)) return <Navigate to="/caregiver/login" replace />;

  // Grouped into explicit sections for clean sidebar navigation
  const navLinks = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', to: '/admin/dashboard', icon: 'dashboard' },
      ],
    },
    {
      label: 'People',
      items: [
        { label: 'Caregivers', to: '/admin/caregivers', icon: 'caregivers' },
        { label: 'Clients', to: '/admin/clients', icon: 'clients' },
        { label: 'Users', to: '/admin/users', icon: 'users' },
        { label: 'Referrals', to: '/admin/referrals', icon: 'referrals' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Compliance', to: '/admin/documents', icon: 'compliance' },
        { label: 'Authorizations', to: '/admin/authorizations', icon: 'authorizations' },
        { label: 'Training', to: '/admin/training', icon: 'training' },
      ],
    },
    {
      label: 'Oversight',
      items: [
        { label: 'Reports', to: '/admin/reports', icon: 'reports' },
        { label: 'Announcements', to: '/admin/announcements', icon: 'announcements' },
        { label: 'Audit Logs', to: '/admin/audit-logs', icon: 'audit' },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Settings', to: '/admin/settings', icon: 'settings' },
        { label: 'Notifications', to: '/admin/notifications', icon: 'notifications', hasBadge: true, badgeCount: unreadCount },
      ],
    },
  ];

  return (
    <PortalShell
      roleBadge="Administrator"
      homePath="/admin/dashboard"
      navLinks={navLinks}
      user={user}
      logout={logout}
      unreadCount={unreadCount}
      notificationsPath="/admin/notifications"
      secondaryAction={{ label: 'Public Site ↗', to: '/florida' }}
    />
  );
}
