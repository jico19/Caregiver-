export default function AuthorizationMetrics({ metrics, filterStatus, onSelectStatus }) {
  return (
    <div className="metric-grid">
      <button
        type="button"
        onClick={() => onSelectStatus('all')}
        className={`metric-btn ${filterStatus === 'all' ? 'metric-btn-all-active' : ''}`}
      >
        <div className="metric-label metric-label-gray">Total Authorizations</div>
        <div className="metric-value metric-value-dark">{metrics.total}</div>
        <div className="metric-hint metric-hint-blue">View all records →</div>
      </button>

      <button
        type="button"
        onClick={() => onSelectStatus('active')}
        className={`metric-btn ${filterStatus === 'active' ? 'metric-btn-active-active' : ''}`}
      >
        <div className="metric-label metric-label-green">Active (Current)</div>
        <div className="metric-value metric-value-green">{metrics.active}</div>
        <div className="metric-hint metric-hint-green">&gt; 30 days remaining</div>
      </button>

      <button
        type="button"
        onClick={() => onSelectStatus('expiring_soon')}
        className={`metric-btn ${filterStatus === 'expiring_soon' ? 'metric-btn-warning-active' : ''}`}
      >
        <div className="metric-label metric-label-amber">Expiring Soon</div>
        <div className="metric-value metric-value-amber">{metrics.expiringSoon}</div>
        <div className="metric-hint metric-hint-amber">Within 30 days</div>
      </button>

      <button
        type="button"
        onClick={() => onSelectStatus('expired')}
        className={`metric-btn ${filterStatus === 'expired' ? 'metric-btn-danger-active' : ''}`}
      >
        <div className="metric-label metric-label-red">Expired</div>
        <div className="metric-value metric-value-red">{metrics.expired}</div>
        <div className="metric-hint metric-hint-red">Requires re-authorization</div>
      </button>
    </div>
  );
}
