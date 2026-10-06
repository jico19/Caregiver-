import { useState, useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import PortalSidebar from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

const COLLAPSED_STORAGE_KEY = 'cp_sidebar_collapsed';

export default function PortalShell({
  roleBadge,
  homePath,
  navLinks = [],
  user,
  logout,
  secondaryAction = null,
  unreadCount = 0,
  notificationsPath = null,
  children = null,
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileOpen(false);
  }

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    if (!mobileOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-base-200 flex text-slate-900">
      <PortalSidebar
        roleBadge={roleBadge}
        homePath={homePath}
        navLinks={navLinks}
        user={user}
        logout={logout}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <PortalTopBar
          roleBadge={roleBadge}
          user={user}
          logout={logout}
          onOpenMobile={() => setMobileOpen(true)}
          secondaryAction={secondaryAction}
          unreadCount={unreadCount}
          notificationsPath={notificationsPath}
        />

        <main className="flex-1 w-full overflow-y-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
