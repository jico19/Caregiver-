import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PortalNavbar from '../components/common/PortalNavbar';
import { isAdmin } from '../lib/roles';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        Loading Admin Operations Portal...
      </div>
    );
  }

  if (!user) return <Navigate to="/caregiver/login" replace />;
  if (user.role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;
  if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;
  if (!isAdmin(user)) return <Navigate to="/caregiver/login" replace />;

  // Grouped into sections so the top row stays short; the brand links to the
  // dashboard, which is why it is not repeated here.
  const navLinks = [
    {
      label: 'People',
      items: [
        { label: 'Caregivers', to: '/admin/caregivers' },
        { label: 'Clients', to: '/admin/clients' },
        { label: 'Users', to: '/admin/users' },
        { label: 'Referrals', to: '/admin/referrals' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Compliance', to: '/admin/documents' },
        { label: 'Authorizations', to: '/admin/authorizations' },
      ],
    },
    {
      label: 'Oversight',
      items: [
        { label: 'Reports', to: '/admin/reports' },
        { label: 'Announcements', to: '/admin/announcements' },
        { label: 'Audit Logs', to: '/admin/audit-logs' },
      ],
    },
  ];

  return (
    <div className="portal-shell">
      <PortalNavbar
        roleBadge="Administrator"
        roleBadgeColor={{
          bg: 'var(--bg-subtle)',
          text: 'var(--text-primary)',
          border: 'var(--border-strong)',
        }}
        homePath="/admin/dashboard"
        navLinks={navLinks}
        user={user}
        logout={logout}
        accentColor="blue"
        secondaryAction={{ label: 'Public Site ↗', to: '/florida' }}
      />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
