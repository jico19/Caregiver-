import { Link } from 'react-router-dom';
import Card from '../../../../shared/components/common/Card';
import StatusBadge from '../../../../shared/components/common/StatusBadge';
import { ROADMAP_STEPS } from '../../../../shared/utils/caregiverStatus';

export default function ApplicationRoadmapCard({
  appStatus,
  meta,
  milestone,
  rejectionReason,
  submittedAt,
  daysAgoText,
}) {
  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
        <h2 className="font-semibold text-base text-slate-900 m-0">
          Onboarding Roadmap
        </h2>
        {appStatus && (
          <StatusBadge status={meta.group || appStatus} label={meta.label} />
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        {ROADMAP_STEPS.map((step, i) => (
          <span key={step.key} className="flex items-center gap-3">
            {i > 0 && <span className="text-xs text-slate-400">→</span>}
            <Link
              to={step.to}
              className="badge badge-soft text-slate-700 hover:text-emerald-800 text-xs px-2.5 py-1"
            >
              {step.label}
            </Link>
          </span>
        ))}
      </div>

      {!appStatus && (
        <div className="p-3.5 rounded bg-emerald-50/50 border border-emerald-200">
          <h3 className="font-semibold text-sm text-slate-900 mb-1">Not Started Yet</h3>
          <p className="text-xs text-slate-600 leading-normal m-0">
            Fill out the form below — it auto-saves as you type, so you can leave and come back within 7 days without losing progress.
          </p>
        </div>
      )}

      {appStatus && (
        <div className="p-3.5 rounded bg-base-200/50 border border-base-300">
          <h3 className="font-semibold text-sm text-slate-900 mb-1">
            {milestone.title}
          </h3>
          <p className="text-xs text-slate-600 leading-normal mb-2">
            {milestone.message}
          </p>

          {rejectionReason && (
            <div className="text-xs text-red-700 p-2.5 bg-red-50/50 border border-red-200 rounded mb-2">
              <strong>Reason:</strong> {rejectionReason}
            </div>
          )}

          {submittedAt && (
            <p className="text-xs text-slate-400 mb-2">
              {daysAgoText} · Submitted on {new Date(submittedAt).toLocaleDateString()}
            </p>
          )}

          <Link to={milestone.nextAction.to} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            {milestone.nextAction.label}
          </Link>
        </div>
      )}
    </Card>
  );
}
