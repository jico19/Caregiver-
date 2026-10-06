import { Link } from 'react-router-dom';
import { ROADMAP_STEPS, stepBadge } from '../../../../shared/utils/caregiverStatus';

export default function ApplicationRoadmapCard({
  appStatus,
  meta,
  milestone,
  rejectionReason,
  submittedAt,
  daysAgoText,
}) {
  return (
    <div className="card mb-6">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
        <h2 className="section-title m-0">
          Onboarding Roadmap
        </h2>
        {appStatus && (
          <span className={`badge ${meta.badge}`}>
            {meta.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        {ROADMAP_STEPS.map((step, i) => (
          <span key={step.key} className="flex items-center gap-3">
            {i > 0 && <span className="text-xs text-muted">→</span>}
            <Link to={step.to} className={`badge ${stepBadge(appStatus, step)}`}>
              {step.label}
            </Link>
          </span>
        ))}
      </div>

      {!appStatus && (
        <div className="banner-info p-4 rounded-md">
          <h3 className="font-semibold text-sm mb-1">Not Started Yet</h3>
          <p className="text-sm text-secondary leading-normal mb-2">
            Fill out the form below — it auto-saves as you type, so you can leave and come back within 7 days without losing progress.
          </p>
        </div>
      )}

      {appStatus && (
        <div className={`p-4 rounded-md ${meta.panelClass}`}>
          <h3 className="font-semibold text-sm mb-1">
            {milestone.title}
          </h3>
          <p className="text-sm text-secondary leading-normal mb-2">
            {milestone.message}
          </p>

          {rejectionReason && (
            <p className="text-sm text-secondary leading-normal p-3 bg-white border border-red-200 rounded-md mb-2">
              <strong>Reason:</strong> {rejectionReason}
            </p>
          )}

          {submittedAt && (
            <p className="text-xs text-muted mb-2">
              {daysAgoText} · Submitted on {new Date(submittedAt).toLocaleDateString()}
            </p>
          )}

          <Link to={milestone.nextAction.to} className="text-sm font-semibold text-primary">
            {milestone.nextAction.label}
          </Link>
        </div>
      )}
    </div>
  );
}
