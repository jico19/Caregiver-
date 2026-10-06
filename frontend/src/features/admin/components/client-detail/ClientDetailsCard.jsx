import { Link } from 'react-router-dom';

export default function ClientDetailsCard({ client }) {
  const stateName = client.states?.name;
  const stateCode = client.states?.code;

  return (
    <div className="card mb-6 p-5">
      <h2 className="section-title m-0 mb-4">Client Details</h2>

      <dl className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-4">
        <div>
          <dt className="text-xs text-muted mb-1">Portal Email</dt>
          <dd className="text-sm font-semibold">{client.users?.email || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">State</dt>
          <dd className="text-sm font-semibold">
            {stateName && stateCode ? `${stateName} (${stateCode})` : stateCode || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">Medicaid #</dt>
          <dd className="text-sm font-semibold">{client.medicaid_number || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">Phone</dt>
          <dd className="text-sm font-semibold">{client.phone || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted mb-1">Registered</dt>
          <dd className="text-sm font-semibold">
            {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>

      {client.address && (
        <div>
          <dt className="text-xs text-muted mb-1">Address</dt>
          <dd className="text-sm text-secondary">{client.address}</dd>
        </div>
      )}

      <div className="mt-4">
        <Link
          to={`/admin/authorizations?client_id=${client.id}&state_id=${client.state_id}`}
          className="text-sm font-semibold text-primary underline"
        >
          Manage authorizations for this client →
        </Link>
      </div>
    </div>
  );
}
