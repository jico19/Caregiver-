import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  UserPlus,
  ShieldCheck,
  FileCheck,
  GraduationCap,
  BarChart3,
  ArrowRight,
  FileText,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [selectedState, setSelectedState] = useState('all');

  const { data, isLoading, error } = useFetch('/admin/dashboard', {
    params: { state: selectedState },
    enabled: !!token,
  });

  const metrics = data?.metrics || {
    total_caregivers: 0,
    total_clients: 0,
    pending_applications: 0,
    pending_documents: 0,
    new_referrals: 0,
    pending_compliance: 0,
  };

  const recentIntakes = data?.recent_intakes || [];
  const openTasks = data?.open_tasks || [];
  const announcements = data?.announcements || [];
  const errorMsg = error ? 'Failed to load operational metrics.' : '';

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <PageContainer>
      {/* Top Header & State Selector */}
      <PageHeader
        title="Administrative Operations Hub"
        subtitle="Multi-state oversight for Florida, Indiana, and Georgia home care branches."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="state-filter" className="text-xs font-semibold text-slate-700">
              Jurisdiction:
            </label>
            <select
              id="state-filter"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="select select-bordered select-xs text-xs bg-base-100"
            >
              {isSuperAdmin && <option value="all">All States (FL, IN, GA)</option>}
              <option value="florida">Florida (FL)</option>
              <option value="indiana">Indiana (IN)</option>
              <option value="georgia">Georgia (GA)</option>
            </select>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                <span className="loading loading-spinner loading-xs" />
                Updating...
              </span>
            )}
          </div>
        }
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-6 shadow-sm">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Operational Jurisdiction Status Banner */}
      <div className="bg-base-100 border border-base-200 rounded-box p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">Multi-State Operations Hub</div>
            <h1 className="text-xl font-bold text-base-content">With Open Arms Healthcare Operations</h1>
            <p className="text-xs text-base-content/70">Florida, Indiana & Georgia State Branches</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-sm badge-success badge-soft font-medium">All Branches Synced</span>
          <span className="badge badge-sm badge-outline font-medium capitalize">{selectedState === 'all' ? 'All Jurisdictions' : selectedState}</span>
        </div>
      </div>

      {/* Department & Operational Portal Launchers */}
      <div className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-3">
          Operational Departments
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            to="/admin/referrals"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <UserPlus size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Client Services</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                Client Intake Dashboard
              </h3>
              <p className="text-xs text-base-content/60 truncate">Referrals, intakes & admissions</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link
            to="/admin/caregivers"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <Users size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Human Resources</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                Staffing & Caregiver Pool
              </h3>
              <p className="text-xs text-base-content/60 truncate">Roster, credentials & onboarding</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link
            to="/admin/authorizations"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <ShieldCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Billing & Clinical</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                Authorizations Tracker
              </h3>
              <p className="text-xs text-base-content/60 truncate">State waivers & unit burn-down</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link
            to="/admin/documents"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <FileCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Compliance</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                Document Verification
              </h3>
              <p className="text-xs text-base-content/60 truncate">CPR, CNA, TB test & screening</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link
            to="/admin/training"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <GraduationCap size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Education</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                In-Service Training Portal
              </h3>
              <p className="text-xs text-base-content/60 truncate">Annual courses & certifications</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link
            to="/admin/reports"
            className="group flex items-start gap-3 p-3.5 bg-base-100 border border-base-200 rounded-box hover:border-primary/40 hover:bg-base-200/30 transition-colors"
          >
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
              <BarChart3 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Operations</span>
              <h3 className="text-sm font-semibold text-base-content group-hover:text-primary transition-colors">
                Reports & Analytics
              </h3>
              <p className="text-xs text-base-content/60 truncate">Audit trails & state metrics</p>
            </div>
            <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>
        </div>
      </div>

      {/* Key Monthly Metrics Strip */}
      <div className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-3">
          Key Operational Metrics
        </h2>
        <div className="stats stats-vertical lg:stats-horizontal shadow-xs bg-base-100 border border-base-200 w-full">
          <div className="stat">
            <div className="stat-title text-xs font-medium">Active Clients</div>
            <div className="stat-value text-2xl font-bold">
              {isLoading ? <span className="skeleton w-14 h-7 inline-block" /> : metrics.total_clients}
            </div>
            <div className="stat-desc">
              <Link to="/admin/clients" className="link link-hover text-primary font-medium inline-flex items-center gap-1 mt-1">
                View Client Roster <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="stat">
            <div className="stat-title text-xs font-medium">New Referrals</div>
            <div className="stat-value text-2xl font-bold text-success">
              {isLoading ? <span className="skeleton w-14 h-7 inline-block" /> : metrics.new_referrals}
            </div>
            <div className="stat-desc">
              <Link to="/admin/referrals" className="link link-hover text-success font-medium inline-flex items-center gap-1 mt-1">
                Intake Pipeline <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="stat">
            <div className="stat-title text-xs font-medium">Active Caregivers</div>
            <div className="stat-value text-2xl font-bold">
              {isLoading ? <span className="skeleton w-14 h-7 inline-block" /> : metrics.total_caregivers}
            </div>
            <div className="stat-desc">
              <Link to="/admin/caregivers" className="link link-hover text-primary font-medium inline-flex items-center gap-1 mt-1">
                Manage Staff <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="stat">
            <div className="stat-title text-xs font-medium">Pending Compliance</div>
            <div className="stat-value text-2xl font-bold text-warning">
              {isLoading ? <span className="skeleton w-14 h-7 inline-block" /> : metrics.pending_compliance}
            </div>
            <div className="stat-desc">
              <Link to="/admin/documents" className="link link-hover text-warning font-medium inline-flex items-center gap-1 mt-1">
                {metrics.pending_applications} apps, {metrics.pending_documents} docs <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Recent Intakes + Action Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Recent Client Intakes Table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-base-200">
            <div>
              <h2 className="font-bold text-base text-slate-900">Recent Client Intakes</h2>
              <p className="text-xs text-slate-500">Latest referrals and admission requests</p>
            </div>
            <Link to="/admin/referrals" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              View All Intakes <ArrowRight size={12} />
            </Link>
          </div>

          {recentIntakes.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No recent intakes found for this jurisdiction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="text-slate-500 border-b border-base-200">
                    <th>Name</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIntakes.map((intake) => (
                    <tr key={intake.id} className="hover">
                      <td className="font-semibold text-slate-800">
                        {intake.first_name} {intake.last_name}
                      </td>
                      <td className="text-slate-600">{intake.referral_source || 'Direct'}</td>
                      <td>
                        <StatusBadge status={intake.status} size="xs" />
                      </td>
                      <td className="text-slate-400">
                        {intake.created_at ? new Date(intake.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right: Open Tasks & Follow-ups */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-base-200">
            <div>
              <h2 className="font-bold text-base text-slate-900">Open Tasks & Follow-ups</h2>
              <p className="text-xs text-slate-500">Items requiring administrative action</p>
            </div>
            <span className="badge badge-sm badge-neutral">{openTasks.length} pending</span>
          </div>

          {openTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              All compliance and intake tasks are up to date.
            </div>
          ) : (
            <div className="space-y-3">
              {openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-100 hover:border-base-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`badge badge-xs ${
                        task.priority === 'high' ? 'badge-error' : 'badge-warning'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-800">{task.title}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{task.category}</div>
                    </div>
                  </div>
                  <Link
                    to={task.target_url}
                    className="btn btn-xs btn-outline btn-primary"
                  >
                    Resolve
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Announcements & Quick Launch Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Announcements (2 cols on lg) */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-base-200">
            <h2 className="font-bold text-base text-slate-900">Agency Announcements</h2>
            <Link to="/admin/announcements" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              Manage Announcements <ArrowRight size={12} />
            </Link>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No active announcements posted.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-3 bg-base-200/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-xs text-slate-900">{ann.title}</h4>
                    <span className="text-[10px] text-slate-400">
                      {ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{ann.body}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick External & Internal Links (1 col on lg) */}
        <Card className="p-5">
          <h2 className="font-bold text-base text-slate-900 mb-3 pb-2 border-b border-base-200">
            Quick Links
          </h2>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/admin/settings" className="text-primary hover:underline flex items-center gap-2">
                <FileText size={14} className="text-slate-500" /> Intake & Admission Forms
              </Link>
            </li>
            <li>
              <Link to="/admin/authorizations" className="text-primary hover:underline flex items-center gap-2">
                <ShieldCheck size={14} className="text-slate-500" /> State Medicaid Authorizations
              </Link>
            </li>
            <li>
              <Link to="/admin/training" className="text-primary hover:underline flex items-center gap-2">
                <GraduationCap size={14} className="text-slate-500" /> Staff Training Portal
              </Link>
            </li>
            <li>
              <Link to="/admin/audit-logs" className="text-primary hover:underline flex items-center gap-2">
                <Lock size={14} className="text-slate-500" /> Security & Audit Trail
              </Link>
            </li>
            <li>
              <Link to="/admin/users" className="text-primary hover:underline flex items-center gap-2">
                <Users size={14} className="text-slate-500" /> Admin User Management
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
