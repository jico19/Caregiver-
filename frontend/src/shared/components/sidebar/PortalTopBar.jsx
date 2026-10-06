import { Link } from 'react-router-dom';
import { stateLabelFor, isAdmin } from '../../lib/roles';

export default function PortalTopBar({
  roleBadge,
  user,
  logout,
  onOpenMobile,
  secondaryAction = null,
  unreadCount = 0,
  notificationsPath = null,
}) {
  const stateCode = stateLabelFor(user);
  const isAdminUser = isAdmin(user);
  const avatarLetter = (user?.email ? user.email[0] : (roleBadge?.[0] || 'U')).toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-14 bg-base-100 border-b border-base-300 px-4 flex items-center justify-between gap-3">
      {/* Left Area: Mobile hamburger + State badges */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="md:hidden btn btn-ghost btn-sm btn-circle text-slate-600 hover:text-slate-900"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* State and Context Indicators */}
        <div className="flex items-center gap-2">
          {stateCode ? (
            <span className="badge badge-sm badge-ghost font-semibold text-slate-700">
              {stateCode} Office
            </span>
          ) : (
            <span className="badge badge-sm badge-ghost font-semibold text-slate-700">
              FL • IN • GA
            </span>
          )}
          {isAdminUser && (
            <span className="badge badge-sm badge-neutral badge-soft font-medium hidden sm:inline-flex">
              Admin Ops
            </span>
          )}
        </div>
      </div>

      {/* Right Area: Secondary action + Notifications + User Menu */}
      <div className="flex items-center gap-2">
        {/* Optional Secondary Action (e.g., Public Site Link) */}
        {secondaryAction && (
          <Link
            to={secondaryAction.to}
            className="btn btn-ghost btn-xs text-slate-600 hover:text-slate-900 hidden sm:inline-flex"
          >
            {secondaryAction.label}
          </Link>
        )}

        {/* Notifications Icon Button */}
        {notificationsPath && (
          <Link
            to={notificationsPath}
            title="Notifications"
            className="btn btn-ghost btn-sm btn-circle relative text-slate-500 hover:text-slate-700"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />
            )}
          </Link>
        )}

        {/* User Identity / Avatar Dropdown */}
        {user && (
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-base-200"
            >
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs select-none">
                {avatarLetter}
              </div>
              <span className="text-xs font-medium text-slate-700 hidden lg:inline-block max-w-[120px] truncate">
                {user.email?.split('@')[0]}
              </span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-200 z-50 text-xs">
              <li className="menu-title px-2 py-1 text-slate-400">
                {user.email}
              </li>
              <li>
                <div className="text-[11px] text-slate-500 py-1">
                  Role: <span className="font-semibold text-slate-700 capitalize">{user.role?.replace('_', ' ') || roleBadge}</span>
                </div>
              </li>
              <div className="divider my-1" />
              {logout && (
                <li>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-error font-medium hover:bg-error/10"
                  >
                    Sign Out
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
