import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import PortalNavbar from '../components/common/PortalNavbar';

export default function CaregiverLayout({ children }) {
  const { user, token, loading, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (token) {
      api.get('/caregivers/me/notifications', token).then((res) => {
        if (!isMounted) return;
        const list = res?.notifications || (Array.isArray(res) ? res : []);
        setUnreadCount(list.filter((n) => !n.read).length);
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [token]);

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
