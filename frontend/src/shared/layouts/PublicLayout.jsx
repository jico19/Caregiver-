import { Outlet, Link, useParams } from 'react-router-dom';
import StateSwitcher from '../../features/public/components/StateSwitcher';
import PortalNavbar from '../components/common/PortalNavbar';

export default function PublicLayout() {
  const { state = 'florida' } = useParams();

  const navLinks = [
    { label: 'Services', to: `/${state}/services` },
    { label: 'Careers', to: `/${state}/careers` },
    { label: 'Forms', to: `/${state}/forms` },
    { label: 'Licensing', to: `/${state}/licensing` },
    { label: 'Contact', to: `/${state}/contact` },
  ];

  return (
    <div className="portal-shell bg-base-200 min-h-screen flex flex-col">
      <PortalNavbar
        homePath={`/${state}`}
        navLinks={navLinks}
        secondaryAction={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">State:</span>
              <StateSwitcher />
            </div>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-sm btn-outline text-slate-700">
                Portals ▾
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-sm border border-base-300 text-xs">
                <li><Link to="/caregiver/login">Caregiver Portal</Link></li>
                <li><Link to="/client/login">Client Portal</Link></li>
              </ul>
            </div>
          </div>
        }
      />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="footer-container bg-base-100 border-t border-base-300 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:justify-between items-center gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} CarePlatform Healthcare Services. Multi-state operations in Florida, Indiana, and Georgia.
          </div>
          <div className="flex gap-4">
            <Link to={`/${state}/licensing`} className="hover:text-slate-800 hover:underline">
              Licensing Disclosures
            </Link>
            <Link to={`/${state}/contact`} className="hover:text-slate-800 hover:underline">
              Contact Coordinators
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
