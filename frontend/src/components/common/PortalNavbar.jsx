import { useState, useEffect, useRef, isValidElement } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { isAdmin, stateLabelFor } from '../../lib/roles';

const DRAWER_ID = 'portal-mobile-nav';
const USER_MENU_KEY = 'user';
const USER_MENU_ID = 'portal-user-menu';

// A section is "current" for any route beneath it. The trailing slash matters:
// without it /client/documents would also light up /client/documents-archive.
function isRouteActive(pathname, to) {
  if (!to) return false;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

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

  // Escape closes the open menu first, then the drawer, handing focus back to
  // whatever opened it
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

  // Keep the page behind an open drawer from scrolling underneath it
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

  // Role theming rides on custom properties so the nav classes in index.css
  // stay accent-agnostic instead of branching per portal here.
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
  const userMenuOpen = openMenu === USER_MENU_KEY;

  const roleBadgeStyle = {
    backgroundColor: roleBadgeColor?.bg || 'var(--primary-light)',
    color: roleBadgeColor?.text || 'var(--primary)',
    border: `1px solid ${roleBadgeColor?.border || 'var(--border-strong)'}`,
  };

  const secondaryLabel =
    secondaryAction && typeof secondaryAction.label === 'string'
      ? secondaryAction.label.replace(/[↗\s]+$/, '')
      : null;

  const getNavLinkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;
  const getMobileNavLinkClass = ({ isActive }) => `mobile-nav-link${isActive ? ' mobile-nav-link-active' : ''}`;
  const getDropdownItemClass = ({ isActive }) => `dropdown-item${isActive ? ' dropdown-item-active' : ''}`;

  // A section's counter is the sum of the pages it holds, so an alert buried
  // two levels down still surfaces on the top row.
  const countFor = (entry) => {
    if (entry.items) {
      return entry.items.reduce(
        (total, item) => total + (item.hasBadge ? item.badgeCount ?? 0 : 0),
        0,
      );
    }
    return entry.hasBadge ? entry.badgeCount ?? 0 : 0;
  };

  const renderCount = (count) =>
    count > 0 ? (
      <span className="badge-counter" aria-label={`${count} unread`}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  // A section holding a single page is just a link — no one-item menu.
  const asLeaf = (entry) => (entry.items ? entry.items[0] : entry);

  const renderSection = (entry) => {
    const isSingle = !entry.items || entry.items.length < 2;
    if (isSingle) {
      const leaf = asLeaf(entry);
      return (
        <NavLink
          key={leaf.to}
          to={leaf.to}
          className={getNavLinkClass}
          onClick={() => setMobileMenuOpen(false)}
        >
          <span>{leaf.label}</span>
          {renderCount(countFor(entry))}
        </NavLink>
      );
    }

    const menuKey = `section:${slugify(entry.label)}`;
    const menuId = `portal-menu-${slugify(entry.label)}`;
    const isOpen = openMenu === menuKey;
    const sectionActive = entry.items.some((item) => isRouteActive(location.pathname, item.to));

    return (
      <div className="dropdown-container" data-nav-menu-root="true" key={menuKey}>
        <button
          type="button"
          ref={(node) => {
            triggerRefs.current[menuKey] = node;
          }}
          className={`nav-link${sectionActive ? ' nav-link-active' : ''}${isOpen ? ' nav-link-open' : ''}`}
          onClick={() => setOpenMenu(isOpen ? null : menuKey)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-controls={menuId}
        >
          <span>{entry.label}</span>
          {renderCount(countFor(entry))}
          <span className={`portal-caret${isOpen ? ' portal-caret-open' : ''}`} aria-hidden="true">
            ▼
          </span>
        </button>

        {isOpen && (
          <div className="dropdown-menu dropdown-menu-start" id={menuId}>
            {entry.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={getDropdownItemClass}
                onClick={() => setOpenMenu(null)}
              >
                <span className="dropdown-item-label">{item.label}</span>
                {renderCount(item.hasBadge ? item.badgeCount ?? 0 : 0)}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMobileEntry = (entry) => {
    const close = () => setMobileMenuOpen(false);
    if (!entry.items || entry.items.length < 2) {
      const leaf = asLeaf(entry);
      return (
        <NavLink key={leaf.to} to={leaf.to} className={getMobileNavLinkClass} onClick={close}>
          <span>{leaf.label}</span>
          {renderCount(countFor(entry))}
        </NavLink>
      );
    }

    // Flat labelled block rather than a nested disclosure: one tap, and the
    // whole section is visible in a drawer that already scrolls.
    return (
      <div className="mobile-nav-section" key={entry.label}>
        <span className="mobile-section-label">{entry.label}</span>
        {entry.items.map((item) => (
          <NavLink key={item.to} to={item.to} className={getMobileNavLinkClass} onClick={close}>
            <span>{item.label}</span>
            {renderCount(item.hasBadge ? item.badgeCount ?? 0 : 0)}
          </NavLink>
        ))}
      </div>
    );
  };

  const renderSecondaryAction = (className) => {
    if (!secondaryAction) return null;
    if (isValidElement(secondaryAction)) return secondaryAction;
    return (
      <Link
        to={secondaryAction.to}
        className={className}
        title={secondaryAction.title || secondaryLabel}
        onClick={() => setMobileMenuOpen(false)}
      >
        <span>{secondaryLabel}</span>
        <span aria-hidden="true">↗</span>
      </Link>
    );
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

        <nav className="desktop-nav navbar-nav" aria-label={`${roleBadge} Navigation`}>
          {navLinks.map(renderSection)}

          {renderSecondaryAction('nav-secondary')}
        </nav>

        <div className="dropdown-container navbar-actions" data-nav-menu-root="true">
          <button
            type="button"
            ref={(node) => {
              triggerRefs.current[USER_MENU_KEY] = node;
            }}
            className={`nav-user-trigger${userMenuOpen ? ' nav-user-trigger-open' : ''}`}
            onClick={() => setOpenMenu(userMenuOpen ? null : USER_MENU_KEY)}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            aria-controls={USER_MENU_ID}
          >
            <span
              className="avatar-circle"
              style={{ backgroundColor: avatarBg }}
              aria-hidden="true"
            >
              {avatarInitial}
            </span>
            <span className="badge navbar-state-chip">{stateCode}</span>
            <span
              className={`portal-caret${userMenuOpen ? ' portal-caret-open' : ''}`}
              aria-hidden="true"
            >
              ▼
            </span>
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu" id={USER_MENU_ID}>
              <div className="user-menu-identity">
                <span className="user-menu-email">{user?.email}</span>
                <span className="user-menu-meta">{identityLine}</span>
              </div>
              <button
                type="button"
                className="dropdown-item dropdown-item-signout"
                onClick={() => {
                  setOpenMenu(null);
                  logout?.();
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

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
        <div className="mobile-drawer" id={DRAWER_ID}>
          <nav className="flex flex-col gap-1" aria-label={`${roleBadge} Mobile Navigation`}>
            {navLinks.map(renderMobileEntry)}

            {renderSecondaryAction('nav-secondary nav-secondary-row')}
          </nav>

          <div className="mobile-user-card">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="avatar-circle"
                style={{ backgroundColor: avatarBg }}
                aria-hidden="true"
              >
                {avatarInitial}
              </div>
              <div className="flex flex-col min-w-0">
                {user?.email && (
                  <span className="mobile-user-name">
                    {user.email}
                  </span>
                )}
                <span className="text-muted text-xs">{identityLine}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                logout?.();
              }}
              className="btn-signout"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
