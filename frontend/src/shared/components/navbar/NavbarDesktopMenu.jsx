import { isValidElement } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { isRouteActive, slugify, countFor, asLeaf } from './navbarHelpers';

export default function NavbarDesktopMenu({
  navLinks,
  openMenu,
  setOpenMenu,
  onRegisterTrigger,
  roleBadge,
  secondaryAction,
}) {
  const location = useLocation();

  const getNavLinkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;
  const getDropdownItemClass = ({ isActive }) => `dropdown-item${isActive ? ' dropdown-item-active' : ''}`;

  const renderCount = (count) =>
    count > 0 ? (
      <span className="badge-counter" aria-label={`${count} unread`}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const renderSection = (entry) => {
    const isSingle = !entry.items || entry.items.length < 2;
    if (isSingle) {
      const leaf = asLeaf(entry);
      return (
        <NavLink
          key={leaf.to}
          to={leaf.to}
          className={getNavLinkClass}
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
          ref={(node) => onRegisterTrigger?.(menuKey, node)}
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

  const renderSecondaryAction = () => {
    if (!secondaryAction) return null;
    if (isValidElement(secondaryAction)) return secondaryAction;
    const secondaryLabel = typeof secondaryAction.label === 'string'
      ? secondaryAction.label.replace(/[↗\s]+$/, '')
      : null;

    return (
      <Link
        to={secondaryAction.to}
        className="nav-secondary"
        title={secondaryAction.title || secondaryLabel}
      >
        <span>{secondaryLabel}</span>
        <span aria-hidden="true">↗</span>
      </Link>
    );
  };

  return (
    <nav className="desktop-nav navbar-nav" aria-label={`${roleBadge} Navigation`}>
      {navLinks.map(renderSection)}
      {renderSecondaryAction()}
    </nav>
  );
}
