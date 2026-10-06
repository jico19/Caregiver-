import { Link } from 'react-router-dom';
import Card from '../../../../shared/components/common/Card';

export default function ClientDetailsCard({ client }) {
  const stateName = client.states?.name;
  const stateCode = client.states?.code;

  return (
    <Card className="mb-6 p-5">
      <h2 className="font-semibold text-base text-slate-900 m-0 mb-4">Client Details</h2>

      <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Portal Email</dt>
          <dd className="text-sm font-semibold text-slate-900">{client.users?.email || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">State</dt>
          <dd className="text-sm font-semibold text-slate-900">
            {stateName && stateCode ? `${stateName} (${stateCode})` : stateCode || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Medicaid #</dt>
          <dd className="text-sm font-mono font-semibold text-emerald-800">{client.medicaid_number || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Phone</dt>
          <dd className="text-sm font-semibold text-slate-900">{client.phone || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 mb-0.5">Registered</dt>
          <dd className="text-sm font-semibold text-slate-900">
            {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>

      {client.address && (
        <div className="pt-3 border-t border-base-300">
          <dt className="text-xs text-slate-400 mb-0.5">Address</dt>
          <dd className="text-xs text-slate-700 leading-normal">{client.address}</dd>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-base-300">
        <Link
          to={`/admin/authorizations?client_id=${client.id}&state_id=${client.state_id}`}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Manage authorizations for this client →
        </Link>
      </div>
    </Card>
  );
}
