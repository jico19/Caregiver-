import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isAdmin, stateLabelFor } from '../../lib/roles';
import { DRAWER_ID } from '../navbar/navbarHelpers';
import NavbarDesktopMenu from '../navbar/NavbarDesktopMenu';
import NavbarMobileDrawer from '../navbar/NavbarMobileDrawer';
import NavbarUserMenu from '../navbar/NavbarUserMenu';

export default function PortalNavbar({
  roleBadge,
  roleBadgeColor,
  homePath,
  navLinks = [],
  user,
  logout,
  accentColor = 'blue',
  secondaryAction = null,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const location = useLocation();
  const toggleRef = useRef(null);
  const triggerRefs = useRef({});

  const handleRegisterTrigger = (key, node) => {
    triggerRefs.current[key] = node;
  };

  // Auto-close on route navigation
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
    setOpenMenu(null);
  }

  // Click outside closes an open section or account menu
  useEffect(() => {
    if (!openMenu) return undefined;
    function handlePointerDown(event) {
      if (event.target.closest('[data-nav-menu-root]')) return;
      setOpenMenu(null);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openMenu]);

  // Escape closes open menu first, then drawer
  useEffect(() => {
    if (!openMenu && !mobileMenuOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (openMenu) {
        const trigger = triggerRefs.current[openMenu];
        setOpenMenu(null);
        trigger?.focus();
        return;
      }
      setMobileMenuOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openMenu, mobileMenuOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const isEmerald = accentColor === 'emerald';
  const themeColor = isEmerald ? 'var(--success)' : 'var(--primary)';
  const themeBgLight = isEmerald ? 'var(--success-light)' : 'var(--primary-light)';
  const isAdminPortal = isAdmin(user) || roleBadge === 'Administrator';
  const avatarBg = isAdminPortal ? 'var(--text-primary)' : themeColor;

  const headerStyle = {
    '--nav-accent': themeColor,
    '--nav-accent-soft': themeBgLight,
    ...(isAdminPortal ? { borderBottom: '2px solid var(--primary)' } : {}),
  };

  const stateCode = stateLabelFor(user);
  const avatarInitial = (user?.email ? user.email[0] : (roleBadge?.[0] || 'U')).toUpperCase();
  const roleLabel = isAdminPortal ? 'Administrator' : roleBadge.replace('& Family', '').trim();
  const identityLine = `${roleLabel} · ${stateCode}`;
  const brandActive = location.pathname === homePath;

  const roleBadgeStyle = {
    backgroundColor: roleBadgeColor?.bg || 'var(--primary-light)',
    color: roleBadgeColor?.text || 'var(--primary)',
    border: `1px solid ${roleBadgeColor?.border || 'var(--border-strong)'}`,
  };

  return (
    <header style={headerStyle}>
      <div className="navbar-inner">
        <Link
          to={homePath}
          className={`brand-link navbar-brand${brandActive ? ' navbar-brand-active' : ''}`}
          aria-current={brandActive ? 'page' : undefined}
        >
          <span className="brand-logo-text">
            CarePlatform
          </span>
          <span className="badge" style={roleBadgeStyle}>
            {roleBadge}
          </span>
        </Link>

        <NavbarDesktopMenu
          navLinks={navLinks}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onRegisterTrigger={handleRegisterTrigger}
          roleBadge={roleBadge}
          secondaryAction={secondaryAction}
        />

        <NavbarUserMenu
          user={user}
          stateCode={stateCode}
          avatarBg={avatarBg}
          avatarInitial={avatarInitial}
          identityLine={identityLine}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onRegisterTrigger={handleRegisterTrigger}
          logout={logout}
        />

        <button
          type="button"
          ref={toggleRef}
          className={`mobile-menu-toggle mobile-menu-btn${mobileMenuOpen ? ' mobile-menu-btn-open' : ''}`}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls={DRAWER_ID}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileMenuOpen && (
        <NavbarMobileDrawer
          navLinks={navLinks}
          onClose={() => setMobileMenuOpen(false)}
          roleBadge={roleBadge}
          secondaryAction={secondaryAction}
          user={user}
          avatarBg={avatarBg}
          avatarInitial={avatarInitial}
          identityLine={identityLine}
          logout={logout}
        />
      )}
    </header>
  );
}
