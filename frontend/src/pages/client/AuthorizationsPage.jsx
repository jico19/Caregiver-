import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function AuthorizationsPage() {
  const { token } = useAuth();
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthorizations() {
      try {
        const res = await api.get('/clients/me/authorizations', token);
        if (!isMounted) return;
        setAuthorizations(res?.authorizations || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load authorization records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadAuthorizations();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleUpload(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!file) {
      setErrorMsg('Please select the authorization document to upload.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Service start and end dates are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      if (notes.trim()) formData.append('notes', notes.trim());

      const res = await api.upload('/clients/me/authorizations', formData, token);
      setSuccessMsg(`Authorization ${res?.authorization?.authorization_number || ''} submitted for review.`);
      setShowUpload(false);
      setFile(null);
      setStartDate('');
      setEndDate('');
      setNotes('');

      const refreshed = await api.get('/clients/me/authorizations', token);
      setAuthorizations(refreshed?.authorizations || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit your authorization document.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openDocument(documentId) {
    if (!documentId) return;
    try {
      const res = await api.get(`/documents/${documentId}/download-url`, token);
      if (res?.download_url) {
        window.open(res.download_url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setErrorMsg('Could not open the linked document.');
    }
  }

  if (loading) {
    return <div className="loading-text">Loading service authorizations...</div>;
  }

  const statusBadge = {
    active: 'badge-green',
    expiring_soon: 'badge-yellow',
    pending: 'badge-blue',
    expired: 'badge-red',
    rejected: 'badge-gray',
  };

  const statusLabel = {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    pending: 'Pending Review',
    expired: 'Expired',
    rejected: 'Rejected',
  };

  const sourceLabel = (source) => (source === 'client' ? 'Self-Submitted' : 'State / Coordinator');

  return (
    <div className="container-wide">
      <div className="page-head">
        <h1 className="page-title">
          Medicaid & Insurance Authorizations
        </h1>
        <p className="page-subtitle">
          Official state authorizations governing covered hours, service periods, and home care provisions.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      <div className="card mb-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h2 className="section-title m-0">
              Submit an Authorization Document
            </h2>
            <p className="text-sm text-muted mt-1">
              Upload a new prior-authorization letter or renewal notice. Submissions are queued for care coordinator review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className={showUpload ? 'btn-cancel' : 'btn-outline-secondary'}
          >
            {showUpload ? 'Close' : 'Upload Document'}
          </button>
        </div>

        {showUpload && (
          <form onSubmit={handleUpload} className="border-t mt-4 pt-4">
            <div className="form-grid-2">
              <div>
                <label htmlFor="auth-upload-file">
                  Authorization Document *
                </label>
                <input
                  id="auth-upload-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label htmlFor="auth-upload-start">
                    Service Start Date *
                  </label>
                  <input
                    id="auth-upload-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="auth-upload-end">
                    Service End Date *
                  </label>
                  <input
                    id="auth-upload-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="auth-upload-notes">
                Notes (optional)
              </label>
              <input
                id="auth-upload-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Renewal for 2026, home health aide 20 hrs/wk"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowUpload(false)} className="btn-cancel">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-success">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title m-0">
            Authorization Records ({authorizations.length})
          </h2>
          <span className="text-xs text-muted">
            Managed by State Medicaid Office
          </span>
        </div>

        {authorizations.length === 0 ? (
          <div className="card-empty">
            <h3 className="section-title mb-2">
              No Authorizations on File
            </h3>
            <p className="text-sm max-w-lg mx-auto mb-6 leading-normal">
              Authorizations are generated once your intake details, physician orders, and Medicaid eligibility have been reviewed by your state coordinator.
            </p>
            <div className="flex justify-center gap-4">
              <button type="button" onClick={() => setShowUpload(true)} className="btn-success">
                Upload Authorization Document
              </button>
              <Link to="/client/intake" className="btn-outline-secondary">
                Complete Intake Details
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Authorization #</th>
                  <th>State</th>
                  <th>Effective Window</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Document</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {authorizations.map((auth) => {
                  const isExpiringSoon = auth.days_until_expiration !== null && auth.days_until_expiration <= 30;
                  const badge = statusBadge[auth.status] || statusBadge.pending;
                  const label = statusLabel[auth.status] || statusLabel.pending;
                  return (
                    <tr key={auth.id}>
                      <td className="font-semibold">
                        {auth.authorization_number}
                      </td>
                      <td className="text-secondary">
                        {auth.states?.code || 'State'}
                      </td>
                      <td className="text-secondary whitespace-nowrap">
                        {auth.start_date} to {auth.end_date}
                        {!isExpiringSoon && auth.days_until_expiration !== null && auth.status === 'active' && (
                          <div className="text-xs text-muted">
                            {auth.days_until_expiration} days remaining
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="text-xs text-secondary">
                        {sourceLabel(auth.source)}
                      </td>
                      <td>
                        {auth.document_id ? (
                          <button
                            type="button"
                            onClick={() => openDocument(auth.document_id)}
                            className="text-success text-sm font-medium underline"
                          >
                            View document
                          </button>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="text-muted text-xs">
                        {auth.notes || 'Routine authorized services'}
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