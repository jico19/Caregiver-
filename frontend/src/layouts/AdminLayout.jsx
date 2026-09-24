import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PortalNavbar from '../components/common/PortalNavbar';

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
  if (user.role !== 'administrator') return <Navigate to="/caregiver/login" replace />;

  const navLinks = [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Caregivers', to: '/admin/caregivers' },
    { label: 'Clients', to: '/admin/clients' },
    { label: 'Referrals', to: '/admin/referrals' },
    { label: 'Compliance', to: '/admin/documents' },
    { label: 'Authorizations', to: '/admin/authorizations' },
    { label: 'Reports', to: '/admin/reports' },
    { label: 'Announcements', to: '/admin/announcements' },
    { label: 'Audit Logs', to: '/admin/audit-logs' },
  ];

  return (
    <div className="portal-shell">
      <PortalNavbar
        roleBadge="Administrator"
        roleBadgeColor={{ bg: '#f1f5f9', text: '#0f172a', border: 'var(--border-strong)' }}
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
