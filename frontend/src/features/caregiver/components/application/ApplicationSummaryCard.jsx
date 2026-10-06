import { Link } from 'react-router-dom';
import Card from '../../../../shared/components/common/Card';

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
    <Card className="p-6">
      <h2 className="font-semibold text-base text-slate-900 m-0 mb-1">
        Your Application Summary
      </h2>
      <p className="text-slate-600 text-sm leading-normal mb-6">
        Your application is under compliance review, so your details can't be edited right now. Here's where things stand:
      </p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Name</dt>
          <dd className="text-sm font-semibold text-slate-900">{firstName} {lastName}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Phone</dt>
          <dd className="text-sm font-semibold text-slate-900">{phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">State Office</dt>
          <dd className="text-sm font-semibold text-slate-900">{stateName}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Submitted</dt>
          <dd className="text-sm font-semibold text-slate-900">
            {submittedAt ? new Date(submittedAt).toLocaleDateString() : '—'}
          </dd>
        </div>
        {notes && (
          <div className="col-span-1 sm:col-span-2">
            <dt className="text-xs text-slate-400 mb-0.5">Experience & Notes</dt>
            <dd className="text-sm text-slate-700 leading-normal">{notes}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link to={milestone.nextAction.to} className="btn btn-primary btn-sm">
          {milestone.nextAction.label}
        </Link>
        <Link to="/caregiver/profile" className="btn btn-outline btn-sm">
          Edit Profile
        </Link>
      </div>
    </Card>
  );
}
