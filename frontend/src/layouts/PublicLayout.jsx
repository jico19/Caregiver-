import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useParams, useLocation } from 'react-router-dom';
import StateSwitcher from '../components/public/StateSwitcher';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const { state = 'florida' } = useParams();
  const { user } = useAuth();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const portalsRef = useRef(null);

  // Auto-close dropdowns and drawers on route change
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
    setPortalsOpen(false);
  }

  // Handle outside click to close portals dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (portalsRef.current && !portalsRef.current.contains(event.target)) {
        setPortalsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key to close menus
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setPortalsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { label: 'Services', to: `/${state}/services` },
    { label: 'Careers', to: `/${state}/careers` },
    { label: 'Forms', to: `/${state}/forms` },
    { label: 'Licensing', to: `/${state}/licensing` },
    { label: 'Contact', to: `/${state}/contact` },
  ];

  const getNavLinkClass = ({ isActive }) =>
    `nav-link${isActive ? ' nav-link-active' : ''}`;

  const getMobileNavLinkClass = ({ isActive }) =>
    `mobile-nav-link${isActive ? ' mobile-nav-link-active' : ''}`;

  return (
    <div className="portal-shell">
      <header>
        <div className="navbar-inner">
          {/* Brand & Desktop Primary Navigation */}
          <div className="flex items-center gap-6">
            <Link to={`/${state}`} className="brand-link">
              <span className="brand-logo-text brand-logo-accent">
                CarePlatform
              </span>
            </Link>

            <nav className="desktop-nav" aria-label="Main Navigation">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={getNavLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Desktop Right Action Blocks */}
          <div className="desktop-actions">
            {/* Block 1: State Switcher */}
            <div className="state-switcher-badge">
              <span className="state-label-text">
                State:
              </span>
              <StateSwitcher />
            </div>

            {/* Block 2: Portals Dropdown */}
            <div className="dropdown-container" ref={portalsRef}>
              <button
                type="button"
                onClick={() => setPortalsOpen((prev) => !prev)}
                aria-expanded={portalsOpen}
                aria-haspopup="menu"
                className={`portal-button${portalsOpen ? ' portal-button-open' : ''}`}
              >
                <span>Portals</span>
                <span className={`portal-caret${portalsOpen ? ' portal-caret-open' : ''}`}>
                  ▼
                </span>
              </button>

              {portalsOpen && (
                <div className="dropdown-menu" role="menu">
                  <Link
                    to="/caregiver/login"
                    role="menuitem"
                    className="dropdown-item dropdown-item-primary"
                    onClick={() => setPortalsOpen(false)}
                  >
                    Caregiver Portal
                  </Link>
                  <Link
                    to="/client/login"
                    role="menuitem"
                    className="dropdown-item dropdown-item-success"
                    onClick={() => setPortalsOpen(false)}
                  >
                    Client Portal
                  </Link>
                  {user?.role === 'administrator' && (
                    <Link
                      to="/admin/dashboard"
                      role="menuitem"
                      className="dropdown-item dropdown-item-muted"
                      onClick={() => setPortalsOpen(false)}
                    >
                      Admin Operations
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Block 3: Apply Now CTA */}
            <Link
              to={`/${state}/careers`}
              className="btn-primary-cta"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className={`mobile-menu-toggle mobile-menu-btn${mobileMenuOpen ? ' mobile-menu-btn-open' : ''}`}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer">
            {/* Primary Nav Links */}
            <nav className="flex flex-col gap-1" aria-label="Mobile Navigation">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={getMobileNavLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* State Switcher in Mobile Drawer */}
            <div className="mobile-user-card">
              <span className="mobile-user-label">
                Select State:
              </span>
              <StateSwitcher />
            </div>

            {/* Portals Section in Mobile Drawer */}
            <div className="flex flex-col gap-2">
              <span className="mobile-section-label">
                Portals & Access
              </span>
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2">
                <Link
                  to="/caregiver/login"
                  className="mobile-grid-link mobile-grid-link-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Caregiver
                </Link>
                <Link
                  to="/client/login"
                  className="mobile-grid-link mobile-grid-link-success"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Client
                </Link>
              </div>

              {user?.role === 'administrator' && (
                <Link
                  to="/admin/dashboard"
                  className="mobile-grid-link mobile-grid-link-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin Operations
                </Link>
              )}
            </div>

            {/* Prominent Mobile CTA */}
            <Link
              to={`/${state}/careers`}
              className="btn-primary-cta btn-primary-cta-large"
              onClick={() => setMobileMenuOpen(false)}
            >
              Apply Now — Work With Us
            </Link>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer-container">
        <div className="footer-inner footer-links">
          <div>
            © {new Date().getFullYear()} CarePlatform Healthcare Services. Multi-state operations in Florida, Indiana, and Georgia.
          </div>
          <div className="flex gap-4">
            <Link to={`/${state}/licensing`}>Licensing Disclosures</Link>
            <Link to={`/${state}/contact`}>Contact Coordinators</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
