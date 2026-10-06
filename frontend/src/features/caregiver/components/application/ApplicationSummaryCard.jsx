import { Link } from 'react-router-dom';

export default function ApplicationSummaryCard({
  firstName,
  lastName,
  phone,
  stateName,
  submittedAt,
  notes,
  milestone,
}) {
  return (
    <div className="card p-6">
      <h2 className="section-title m-0 mb-1">
        Your Application Summary
      </h2>
      <p className="text-secondary text-sm leading-normal mb-4">
        Your application is under compliance review, so your details can't be edited right now. Here's where things stand:
      </p>

      <dl className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-6">
        <div>
          <dt className="text-xs text-muted mb-1">Name</dt>
          <dd className="text-sm font-semibold">{firstName} {lastName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">Phone</dt>
          <dd className="text-sm font-semibold">{phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">State Office</dt>
          <dd className="text-sm font-semibold">{stateName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">Submitted</dt>
          <dd className="text-sm font-semibold">
            {submittedAt ? new Date(submittedAt).toLocaleDateString() : '—'}
          </dd>
        </div>
        {notes && (
          <div className="col-span-2">
            <dt className="text-xs text-muted mb-1">Experience & Notes</dt>
            <dd className="text-sm text-secondary leading-normal">{notes}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link to={milestone.nextAction.to} className="btn-primary">
          {milestone.nextAction.label}
        </Link>
        <Link to="/caregiver/profile" className="btn-outline-secondary">
          Edit Profile →
        </Link>
      </div>
    </div>
  );
}
