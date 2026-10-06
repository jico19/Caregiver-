import { isValidElement } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { DRAWER_ID, countFor, asLeaf } from './navbarHelpers';

export default function NavbarMobileDrawer({
  navLinks,
  onClose,
  roleBadge,
  secondaryAction,
  user,
  avatarBg,
  avatarInitial,
  identityLine,
  logout,
}) {
  const getMobileNavLinkClass = ({ isActive }) =>
    `mobile-nav-link${isActive ? ' mobile-nav-link-active' : ''}`;

  const renderCount = (count) =>
    count > 0 ? (
      <span className="badge-counter" aria-label={`${count} unread`}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const renderMobileEntry = (entry) => {
    if (!entry.items || entry.items.length < 2) {
      const leaf = asLeaf(entry);
      return (
        <NavLink key={leaf.to} to={leaf.to} className={getMobileNavLinkClass} onClick={onClose}>
          <span>{leaf.label}</span>
          {renderCount(countFor(entry))}
        </NavLink>
      );
    }

    return (
      <div className="mobile-nav-section" key={entry.label}>
        <span className="mobile-section-label">{entry.label}</span>
        {entry.items.map((item) => (
          <NavLink key={item.to} to={item.to} className={getMobileNavLinkClass} onClick={onClose}>
            <span>{item.label}</span>
            {renderCount(item.hasBadge ? item.badgeCount ?? 0 : 0)}
          </NavLink>
        ))}
      </div>
    );
  };

  const renderSecondaryAction = () => {
    if (!secondaryAction) return null;
    if (isValidElement(secondaryAction)) return secondaryAction;
    const secondaryLabel = typeof secondaryAction.label === 'string'
      ? secondaryAction.label.replace(/[↗\s]+$/, '')
      : null;

    return (
      <Link
        to={secondaryAction.to}
        className="nav-secondary nav-secondary-row"
        title={secondaryAction.title || secondaryLabel}
        onClick={onClose}
      >
        <span>{secondaryLabel}</span>
        <span aria-hidden="true">↗</span>
      </Link>
    );
  };

  return (
    <div className="mobile-drawer" id={DRAWER_ID}>
      <nav className="flex flex-col gap-1" aria-label={`${roleBadge} Mobile Navigation`}>
        {navLinks.map(renderMobileEntry)}
        {renderSecondaryAction()}
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
            onClose();
            logout?.();
          }}
          className="btn-signout"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
