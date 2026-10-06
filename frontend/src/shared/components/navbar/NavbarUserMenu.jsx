import { USER_MENU_KEY, USER_MENU_ID } from './navbarHelpers';

export default function NavbarUserMenu({
  user,
  stateCode,
  avatarBg,
  avatarInitial,
  identityLine,
  openMenu,
  setOpenMenu,
  onRegisterTrigger,
  logout,
}) {
  const userMenuOpen = openMenu === USER_MENU_KEY;

  return (
    <div className="dropdown-container navbar-actions" data-nav-menu-root="true">
      <button
        type="button"
        ref={(node) => onRegisterTrigger?.(USER_MENU_KEY, node)}
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
  );
}
