import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const STATE_CODE_MAP = {
  1: 'FL',
  2: 'IN',
  3: 'GA',
};

const STATUS_BADGE_CLASS = {
  active: 'badge badge-green',
  expiring_soon: 'badge badge-yellow',
  expired: 'badge badge-red',
  pending: 'badge badge-blue',
  rejected: 'badge badge-gray',
};

const STATUS_DAYS_CLASS = {
  active: 'days-text days-active',
  expiring_soon: 'days-text days-soon',
  expired: 'days-text days-expired',
};

function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeFutureDateStr(baseDateStr, daysToAdd) {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + daysToAdd);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function generateAuthNumber(stateCode = 'FL') {
  const code = (stateCode || 'FL').toUpperCase();
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `AUTH-${code}-${year}-${randomSuffix}`;
}

function getAuthStatusDetails(startDateStr, endDateStr, rawStatus) {
  if (rawStatus === 'pending') {
    return {
      statusKey: 'pending',
      label: 'Pending Review',
      daysText: 'Awaiting review',
    };
  }

  if (rawStatus === 'rejected') {
    return {
      statusKey: 'rejected',
      label: 'Rejected',
      daysText: 'Not approved',
    };
  }

  if (!endDateStr) {
    return {
      statusKey: rawStatus || 'active',
      label: (rawStatus || 'ACTIVE').toUpperCase(),
      daysText: 'Active',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      statusKey: 'expired',
      label: 'Expired',
      daysText: `Expired ${Math.abs(diffDays)}d ago`,
    };
  }

  if (diffDays <= 30) {
    return {
      statusKey: 'expiring_soon',
      label: 'Expiring Soon',
      daysText: `${diffDays}d left`,
    };
  }

  return {
    statusKey: 'active',
    label: 'Active',
    daysText: `${diffDays}d left`,
  };
}

const COMMON_NOTE_PRESETS = [
  'Personal Care Assistance (PCA) — 20 hrs/wk',
  'Home Health Aide (HHA) — Skilled Care',
  'Companion & Homemaker Services — 15 hrs/wk',
  'Respite Care Services — Level 2 support',
];

export default function AuthorizationsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();

  const [authorizations, setAuthorizations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pending-review actions
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewAction, setReviewAction] = useState('');

  // UI state
  const [showForm, setShowForm] = useState(Boolean(searchParams.get('client_id')));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('end_date_asc');
  const [copiedAuthId, setCopiedAuthId] = useState(null);

  // Form fields
  const [clientId, setClientId] = useState(searchParams.get('client_id') || '');
  const [stateId, setStateId] = useState(searchParams.get('state_id') || '1');
  const [authNumber, setAuthNumber] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(computeFutureDateStr(getTodayStr(), 180)); // 6 months default
  const [notes, setNotes] = useState('');

  // Fetch data on mount
  useEffect(() => {
    let isMounted = true;
    const initialParamClientId = searchParams.get('client_id');

    async function loadData() {
      try {
        const [authRes, clientRes] = await Promise.all([
          api.get('/admin/authorizations?page_size=100', token),
          api.get('/admin/clients?page_size=100', token),
        ]);

        if (!isMounted) return;
        setAuthorizations(authRes?.authorizations || []);
        const cl = clientRes?.clients || [];
        setClients(cl);

        const targetClient = initialParamClientId
          ? cl.find((c) => c.id === initialParamClientId)
          : cl[0];

        if (targetClient) {
          setClientId(targetClient.id);
          const sId = String(targetClient.state_id || 1);
          setStateId(sId);
          const stateCode = targetClient.states?.code || STATE_CODE_MAP[sId] || 'FL';
          setAuthNumber(generateAuthNumber(stateCode));
        } else {
          setAuthNumber(generateAuthNumber('FL'));
        }
      } catch {
        if (!isMounted) return;
        setErrorMsg('Failed to load authorization records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [token, searchParams]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || null;
  }, [clients, clientId]);

  function handleClientChange(newClientId) {
    setClientId(newClientId);
    const cl = clients.find((c) => c.id === newClientId);
    if (cl) {
      const sId = String(cl.state_id || 1);
      setStateId(sId);
      const code = cl.states?.code || STATE_CODE_MAP[sId] || 'FL';
      setAuthNumber(generateAuthNumber(code));
    }
  }

  function handleRegenerateAuthNumber() {
    const code = selectedClient?.states?.code || STATE_CODE_MAP[stateId] || 'FL';
    setAuthNumber(generateAuthNumber(code));
  }

  function applyDurationPreset(days) {
    const base = startDate || getTodayStr();
    setEndDate(computeFutureDateStr(base, days));
  }

  function handleCopyAuthNumber(num, id) {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedAuthId(id);
    setTimeout(() => setCopiedAuthId(null), 2000);
  }

  async function handleCreateAuth(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!authNumber.trim()) {
      setErrorMsg('Authorization number cannot be empty.');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setErrorMsg('End date must be after start date.');
      return;
    }

    setSubmitting(true);

    const payload = {
      client_id: clientId,
      state_id: parseInt(stateId, 10),
      authorization_number: authNumber.trim(),
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
    };

    try {
      await api.post('/admin/authorizations', payload, token);
      setSuccessMsg(`Authorization ${payload.authorization_number} issued successfully.`);

      // Reset form with new auto-generated number
      const code = selectedClient?.states?.code || STATE_CODE_MAP[stateId] || 'FL';
      setAuthNumber(generateAuthNumber(code));
      setStartDate(getTodayStr());
      setEndDate(computeFutureDateStr(getTodayStr(), 180));
      setNotes('');

      // Refresh list
      const res = await api.get('/admin/authorizations?page_size=100', token);
      setAuthorizations(res?.authorizations || []);
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to issue authorization.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(authorizationId, action) {
    if (!window.confirm(`Mark this authorization ${action === 'approved' ? 'approved (Active)' : 'rejected'}? The client will be notified.`)) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setReviewingId(authorizationId);
    setReviewAction(action);
    try {
      await api.post(`/admin/authorizations/${authorizationId}/review`, { status: action }, token);
      setSuccessMsg(action === 'approved'
        ? 'Authorization approved and activated.'
        : 'Authorization rejected.');
      setReviewingId(null);
      setReviewAction('');
      const res = await api.get('/admin/authorizations?page_size=100', token);
      setAuthorizations(res?.authorizations || []);
    } catch (err) {
      setErrorMsg(err.detail || `Failed to ${action} the authorization.`);
      setReviewingId(null);
      setReviewAction('');
    }
  }
  const metrics = useMemo(() => {
    let total = authorizations.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;

    for (const a of authorizations) {
      const info = getAuthStatusDetails(a.start_date, a.end_date, a.status);
      if (info.statusKey === 'expired') {
        expired++;
      } else if (info.statusKey === 'expiring_soon') {
        expiringSoon++;
      } else {
        active++;
      }
    }

    return { total, active, expiringSoon, expired };
  }, [authorizations]);

  // Filtered and sorted authorizations
  const filteredAuthorizations = useMemo(() => {
    return authorizations
      .filter((a) => {
        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const authMatch = a.authorization_number?.toLowerCase().includes(q);
          const clientName = `${a.clients?.first_name || ''} ${a.clients?.last_name || ''}`.toLowerCase();
          const clientMatch = clientName.includes(q);
          const medMatch = a.clients?.medicaid_number?.toLowerCase().includes(q);
          const notesMatch = a.notes?.toLowerCase().includes(q);
          if (!authMatch && !clientMatch && !medMatch && !notesMatch) return false;
        }

        // State filter
        if (filterState !== 'all') {
          const code = (a.states?.code || '').toLowerCase();
          if (code !== filterState.toLowerCase()) return false;
        }

        // Status filter
        if (filterStatus !== 'all') {
          const info = getAuthStatusDetails(a.start_date, a.end_date, a.status);
          if (info.statusKey !== filterStatus) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'end_date_asc') {
          return new Date(a.end_date) - new Date(b.end_date);
        }
        if (sortBy === 'end_date_desc') {
          return new Date(b.end_date) - new Date(a.end_date);
        }
        if (sortBy === 'created_desc') {
          return new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date);
        }
        if (sortBy === 'client_name') {
          const nameA = `${a.clients?.last_name || ''} ${a.clients?.first_name || ''}`;
          const nameB = `${b.clients?.last_name || ''} ${b.clients?.first_name || ''}`;
          return nameA.localeCompare(nameB);
        }
        return 0;
      });
  }, [authorizations, searchTerm, filterState, filterStatus, sortBy]);

  const hasActiveFilters = searchTerm !== '' || filterState !== 'all' || filterStatus !== 'all';

  function handleResetFilters() {
    setSearchTerm('');
    setFilterState('all');
    setFilterStatus('all');
    setSortBy('end_date_asc');
  }

  return (
    <div className="container-1120">
      {/* Page Header */}
      <div className="page-header items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="page-title m-0">
              Medicaid Authorizations
            </h1>
            <span className="badge badge-blue">
              FL • IN • GA
            </span>
          </div>
          <p className="page-subtitle m-0">
            Issue, track expiration windows, and maintain compliance for state Medicaid service approvals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className={`btn-toggle ${showForm ? 'btn-neutral' : 'btn-success'}`}
        >
          {showForm ? (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Close Form
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Issue New Authorization
            </>
          )}
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div role="alert" className="alert alert-error alert-row">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="alert-dismiss">✕</button>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success alert-row">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="alert-dismiss">✕</button>
        </div>
      )}

      {/* Metric Cards / Quick Status Filters */}
      <div className="metric-grid">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`metric-btn ${filterStatus === 'all' ? 'metric-btn-all-active' : ''}`}
        >
          <div className="metric-label metric-label-gray">Total Authorizations</div>
          <div className="metric-value metric-value-dark">{metrics.total}</div>
          <div className="metric-hint metric-hint-blue">View all records →</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('active')}
          className={`metric-btn ${filterStatus === 'active' ? 'metric-btn-active-active' : ''}`}
        >
          <div className="metric-label metric-label-green">Active (Current)</div>
          <div className="metric-value metric-value-green">{metrics.active}</div>
          <div className="metric-hint metric-hint-green">&gt; 30 days remaining</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('expiring_soon')}
          className={`metric-btn ${filterStatus === 'expiring_soon' ? 'metric-btn-warning-active' : ''}`}
        >
          <div className="metric-label metric-label-amber">Expiring Soon</div>
          <div className="metric-value metric-value-amber">{metrics.expiringSoon}</div>
          <div className="metric-hint metric-hint-amber">Within 30 days</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('expired')}
          className={`metric-btn ${filterStatus === 'expired' ? 'metric-btn-danger-active' : ''}`}
        >
          <div className="metric-label metric-label-red">Expired</div>
          <div className="metric-value metric-value-red">{metrics.expired}</div>
          <div className="metric-hint metric-hint-red">Requires re-authorization</div>
        </button>
      </div>

      {/* Issuance Form (Collapsible Card) */}
      {showForm && (
        <div className="auth-issue-card">
          <div className="card-head-bordered">
            <div>
              <h2 className="heading-card m-0">
                Issue Medicaid Service Authorization
              </h2>
              <p className="form-hint">
                Authorization numbers are auto-formatted per state Medicaid guidelines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-icon-muted"
              title="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateAuth}>
            <div className="form-grid-2">
              {/* Select Client */}
              <div>
                <label htmlFor="auth-client" className="form-label-strong">
                  Client *
                </label>
                <select
                  id="auth-client"
                  required
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  {clients.map((c) => {
                    const stCode = c.states?.code || STATE_CODE_MAP[c.state_id] || 'FL';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({stCode}) {c.medicaid_number ? `— Medicaid: ${c.medicaid_number}` : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedClient?.medicaid_number && (
                  <div className="field-hint">
                    Medicaid ID: <strong className="text-ink">{selectedClient.medicaid_number}</strong>
                  </div>
                )}
              </div>

              {/* Auto-generated Authorization # */}
              <div>
                <div className="label-row">
                  <label htmlFor="auth-num">
                    Authorization # *
                  </label>
                  <span className="chip-success">
                    Auto-generated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="auth-num"
                    type="text"
                    required
                    value={authNumber}
                    onChange={(e) => setAuthNumber(e.target.value)}
                    placeholder="E.g., AUTH-FL-2026-1049"
                    className="input-mono"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateAuthNumber}
                    title="Generate new authorization code"
                    className="btn-reroll"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Re-roll
                  </button>
                </div>
                <div className="field-hint-sm">
                  Automatically generated. You can modify this to match an official state PA notice.
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label htmlFor="auth-start" className="form-label-strong">
                  Start Date *
                </label>
                <input
                  id="auth-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date + Presets */}
              <div>
                <div className="label-row">
                  <label htmlFor="auth-end">
                    End Date *
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyDurationPreset(90)}
                      className="btn-preset"
                    >
                      +90d
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDurationPreset(180)}
                      className="btn-preset"
                    >
                      +6mo
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDurationPreset(365)}
                      className="btn-preset"
                    >
                      +1yr
                    </button>
                  </div>
                </div>
                <input
                  id="auth-end"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Covered Services / Notes */}
              <div className="col-span-full">
                <div className="label-row flex-wrap gap-2">
                  <label htmlFor="auth-notes">
                    Covered Services & Approved Units
                  </label>
                  <div className="flex items-center gap-1 flex-wrap">
                    {COMMON_NOTE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNotes(preset)}
                        className="btn-preset-ghost"
                      >
                        + {preset.split('—')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="auth-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g., 20 hours/week Personal Care Assistance, Level 2 assistance"
                />
              </div>
            </div>

            <div className="form-footer">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-success btn-submit-auth"
              >
                {submitting ? 'Issuing Authorization...' : 'Issue Authorization'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Management Toolbar: Search, Filters & Sorting */}
      <div className="toolbar-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="search-wrap">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Auth #, Client name, Medicaid #..."
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="search-clear"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {/* State filter */}
            <select
              aria-label="Filter by state"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="filter-select"
            >
              <option value="all">All States</option>
              <option value="FL">Florida (FL)</option>
              <option value="IN">Indiana (IN)</option>
              <option value="GA">Georgia (GA)</option>
            </select>

            {/* Status filter */}
            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="expiring_soon">Expiring Soon (≤30d)</option>
              <option value="expired">Expired</option>
            </select>

            {/* Sort order */}
            <select
              aria-label="Sort authorizations"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="end_date_asc">Expiration: Soonest First</option>
              <option value="end_date_desc">Expiration: Latest First</option>
              <option value="created_desc">Recently Issued</option>
              <option value="client_name">Client Name (A–Z)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-reset"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Results counter */}
        <div className="results-bar">
          <span>
            Showing <strong>{filteredAuthorizations.length}</strong> of <strong>{authorizations.length}</strong> authorization{authorizations.length === 1 ? '' : 's'}
          </span>
          {hasActiveFilters && (
            <span className="filter-active-label">
              Filtered view active
            </span>
          )}
        </div>
      </div>

      {/* Authorizations Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="spinner-md" />
            <div className="mt-3">Loading Medicaid authorizations...</div>
          </div>
        ) : filteredAuthorizations.length === 0 ? (
          <div className="table-empty">
            <svg className="empty-icon" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="card-title mb-1">
              {authorizations.length === 0 ? 'No Authorizations on Record' : 'No Matching Authorizations Found'}
            </h3>
            <p className="empty-text">
              {authorizations.length === 0
                ? 'Issue your first Medicaid service authorization using the form above.'
                : 'Try adjusting your search terms, state, or status filters.'}
            </p>
            {authorizations.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="btn-success"
              >
                + Issue First Authorization
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-reset"
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-auth">
              <thead>
                <tr className="table-head-row">
                  <th>Authorization #</th>
                  <th>Client</th>
                  <th>State</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Covered Services / Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuthorizations.map((a) => {
                  const statusInfo = getAuthStatusDetails(a.start_date, a.end_date, a.status);
                  const isCopied = copiedAuthId === a.id;

                  return (
                    <tr key={a.id} className="table-row">
                      {/* Auth Number + Copy Button */}
                      <td className="whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span className="auth-number">
                            {a.authorization_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAuthNumber(a.authorization_number, a.id)}
                            title="Copy Authorization #"
                            className={`btn-copy ${isCopied ? 'btn-copy-copied' : ''}`}
                          >
                            {isCopied ? (
                              <span className="copy-confirm">✓ Copied</span>
                            ) : (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Client */}
                      <td>
                        <div className="cell-strong">
                          {a.clients?.first_name} {a.clients?.last_name}
                        </div>
                        {a.clients?.medicaid_number && (
                          <div className="cell-sub">
                            Medicaid: <span className="font-mono">{a.clients.medicaid_number}</span>
                          </div>
                        )}
                      </td>

                      {/* State */}
                      <td>
                        <span className="state-chip">
                          {a.states?.code || 'FL'}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="cell-muted whitespace-nowrap">
                        {a.start_date}
                      </td>

                      {/* End Date + Days countdown */}
                      <td className="whitespace-nowrap">
                        <div className="cell-medium">{a.end_date}</div>
                        <div className={STATUS_DAYS_CLASS[statusInfo.statusKey] || 'days-text'}>
                          {statusInfo.daysText}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap">
                        <span className={STATUS_BADGE_CLASS[statusInfo.statusKey] || 'badge badge-gray'}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="cell-notes">
                        {a.notes ? (
                          <div className="truncate" title={a.notes}>
                            {a.notes}
                          </div>
                        ) : (
                          <span className="text-italic-muted">Standard authorization</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap">
                        {a.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReview(a.id, 'approved')}
                              disabled={reviewingId === a.id}
                              className="btn-sm btn-success"
                            >
                              {reviewingId === a.id && reviewAction === 'approved' ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReview(a.id, 'rejected')}
                              disabled={reviewingId === a.id}
                              className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                            >
                              {reviewingId === a.id && reviewAction === 'rejected' ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        ) : (
                          <a
                            href={`/admin/clients/${a.client_id}`}
                            className="text-sm font-medium text-secondary underline"
                          >
                            View client
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
