import { useState, useEffect, isValidElement } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

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
  const location = useLocation();

  // Auto-close mobile drawer on route navigation
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  // Handle Escape key to close mobile menu
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isEmerald = accentColor === 'emerald';
  const themeColor = isEmerald ? 'var(--success)' : 'var(--primary)';
  const themeBgLight = isEmerald ? 'var(--success-light)' : 'var(--primary-light)';
  const avatarBg = roleBadge === 'Administrator' ? '#0f172a' : themeColor;
  const headerStyle = roleBadge === 'Administrator' ? { borderBottom: '2px solid var(--primary)' } : undefined;

  const getStateCode = () => {
    if (!user) return '';
    if (user.states?.code) return user.states.code.toUpperCase();
    if (user.state_code) return user.state_code.toUpperCase();
    if (user.state_id === 1) return 'FL';
    if (user.state_id === 2) return 'IN';
    if (user.state_id === 3) return 'GA';
    if (typeof user.state === 'string' && user.state.trim() !== '') {
      const s = user.state.toLowerCase();
      if (s.includes('florida') || s === 'fl') return 'FL';
      if (s.includes('indiana') || s === 'in') return 'IN';
      if (s.includes('georgia') || s === 'ga') return 'GA';
      return user.state.toUpperCase();
    }
    return user.role === 'administrator' || roleBadge === 'Administrator' ? 'All States' : 'FL';
  };

  const stateCode = getStateCode();
  const avatarInitial = (user?.email ? user.email[0] : (roleBadge?.[0] || 'U')).toUpperCase();

  const getNavLinkStyle = ({ isActive }) => ({
    fontWeight: isActive ? 600 : 500,
    color: isActive ? themeColor : 'var(--text-secondary)',
    backgroundColor: isActive ? themeBgLight : 'transparent',
    borderBottom: isActive ? `2px solid ${themeColor}` : '2px solid transparent',
    borderRadius: 'var(--radius-sm)',
    padding: '0.35rem 0.65rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.15s ease',
  });

  const getMobileNavLinkStyle = ({ isActive }) => ({
    fontWeight: isActive ? 600 : 500,
    color: isActive ? themeColor : 'var(--text-secondary)',
    borderLeft: isActive ? `3px solid ${themeColor}` : '3px solid transparent',
    backgroundColor: isActive ? themeBgLight : 'transparent',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.95rem',
    transition: 'all 0.15s ease',
  });

  return (
    <header style={headerStyle}>
      <div className="navbar-inner">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-4">
          <Link to={homePath} className="brand-link">
            <div className="flex items-center gap-2">
              <span className="brand-logo-text">
                CarePlatform
              </span>
              <span
                className="badge"
                style={{
                  backgroundColor: roleBadgeColor?.bg || 'var(--primary-light)',
                  color: roleBadgeColor?.text || 'var(--primary)',
                  border: `1px solid ${roleBadgeColor?.border || '#bfdbfe'}`,
                }}
              >
                {roleBadge}
              </span>
            </div>
          </Link>

          <nav className="desktop-nav" aria-label={`${roleBadge} Navigation`}>
            {navLinks.map((link) => {
              const count = link.badgeCount ?? 0;
              return (
                <NavLink key={link.to} to={link.to} style={getNavLinkStyle}>
                  <span>{link.label}</span>
                  {link.hasBadge && count > 0 && (
                    <span className="badge-counter">
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}

            {secondaryAction &&
              (isValidElement(secondaryAction) ? (
                secondaryAction
              ) : (
                <Link
                  to={secondaryAction.to}
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.3rem 0.55rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    marginLeft: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                  title={secondaryAction.title || (typeof secondaryAction.label === 'string' ? secondaryAction.label : undefined)}
                >
                  {secondaryAction.label}
                </Link>
              ))}
          </nav>
        </div>

        {/* Desktop User Identity Block */}
        <div className="desktop-actions">
          <div
            className="avatar-circle"
            style={{ backgroundColor: avatarBg }}
            aria-hidden="true"
          >
            {avatarInitial}
          </div>

          {roleBadge === 'Administrator' && (
            <span
              className="badge"
              style={{
                backgroundColor: roleBadgeColor?.bg || '#f1f5f9',
                color: roleBadgeColor?.text || '#0f172a',
                border: `1px solid ${roleBadgeColor?.border || 'var(--border-strong)'}`,
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                fontWeight: 600,
              }}
            >
              Administrator
            </span>
          )}

          <span
            className="badge"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
            }}
          >
            {stateCode}
          </span>

          {user?.email && (
            <span
              style={{
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user.email}
            >
              {user.email}
            </span>
          )}

          <button
            type="button"
            onClick={logout}
            className="btn-signout"
          >
            Sign Out
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          style={{
            padding: '0.4rem 0.65rem',
            backgroundColor: mobileMenuOpen ? 'var(--bg-subtle)' : 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '1.1rem',
            lineHeight: 1,
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          {/* Mobile Nav Links */}
          <nav className="flex flex-col gap-1" aria-label={`${roleBadge} Mobile Navigation`}>
            {navLinks.map((link) => {
              const count = link.badgeCount ?? 0;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  style={getMobileNavLinkStyle}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{link.label}</span>
                  {link.hasBadge && count > 0 && (
                    <span className="badge-counter" style={{ marginLeft: 0 }}>
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}

            {secondaryAction &&
              (isValidElement(secondaryAction) ? (
                <div onClick={() => setMobileMenuOpen(false)}>{secondaryAction}</div>
              ) : (
                <Link
                  to={secondaryAction.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    marginTop: '0.25rem',
                  }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>
                    {typeof secondaryAction.label === 'string'
                      ? secondaryAction.label.replace(/[↗\s]+$/, '')
                      : secondaryAction.label}
                  </span>
                  <span>↗</span>
                </Link>
              ))}
          </nav>

          {/* Mobile User Profile Info */}
          <div className="mobile-user-card">
            <div className="flex items-center gap-2" style={{ overflow: 'hidden' }}>
              <div
                className="avatar-circle"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: avatarBg,
                  fontSize: '0.85rem',
                }}
                aria-hidden="true"
              >
                {avatarInitial}
              </div>
              <div className="flex flex-col" style={{ overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.email}
                </span>
                <span className="text-muted text-xs">
                  {roleBadge === 'Administrator'
                    ? `Administrator · ${stateCode}`
                    : `${roleBadge.replace('& Family', '').trim()} Portal`}
                </span>
              </div>
            </div>
            <span
              className="badge"
              style={{
                backgroundColor: roleBadgeColor?.bg || 'var(--primary-light)',
                color: roleBadgeColor?.text || 'var(--primary)',
                border: `1px solid ${roleBadgeColor?.border || '#bfdbfe'}`,
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                flexShrink: 0,
              }}
            >
              {roleBadge === 'Administrator' ? 'Admin' : stateCode}
            </span>
          </div>

          {/* Mobile Full-width Sign Out */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              logout?.();
            }}
            className="btn-mobile-signout"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
