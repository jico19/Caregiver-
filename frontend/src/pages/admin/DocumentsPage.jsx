import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const STATUS_BADGE = {
  pending_review: { className: 'badge badge-yellow', label: 'Pending' },
  approved: { className: 'badge badge-green', label: 'Approved' },
  rejected: { className: 'badge badge-red', label: 'Rejected' },
  expired: { className: 'badge badge-gray', label: 'Expired' },
};

export default function DocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const url = statusFilter === 'all' ? '/admin/documents' : `/admin/documents?status=${statusFilter}`;
    api.get(url, token)
      .then((res) => {
        if (!isMounted) return;
        setDocuments(res?.documents || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg('Failed to load compliance document queue.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [statusFilter, token]);

  async function handleReview(docId, newStatus) {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(docId);

    try {
      await api.post(`/admin/documents/${docId}/review`, { status: newStatus }, token);
      setSuccessMsg(`Document marked as ${newStatus}.`);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: newStatus } : d))
      );
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update document status.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleInspect(docId) {
    try {
      const res = await api.get(`/documents/${docId}/download-url`, token);
      if (res?.download_url) {
        window.open(res.download_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err.detail || 'Could not retrieve file link.');
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Document Compliance & Verification
          </h1>
          <p className="page-subtitle">
            Verify credentials, CPR certifications, background screening, and physician plans across state offices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-doc-status" className="filter-label">
            Status:
          </label>
          <select
            id="filter-doc-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-compact"
          >
            <option value="all">All Documents</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
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

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading document queue...</div>
        ) : documents.length === 0 ? (
          <div className="table-empty-sm">
            No documents found matching the filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Owner</th>
                  <th>State</th>
                  <th>Uploaded</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const status = STATUS_BADGE[doc.status] || STATUS_BADGE.pending_review;
                  const isBusy = actionLoading === doc.id;

                  return (
                    <tr key={doc.id}>
                      <td className="cell-strong">
                        {doc.document_types?.name || 'Document'}
                      </td>
                      <td className="cell-muted text-xs">
                        {doc.users?.email || doc.owner_id?.slice(0, 8)}
                      </td>
                      <td className="cell-muted">
                        {doc.states?.code || 'FL'}
                      </td>
                      <td className="cell-muted">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="cell-muted">
                        {doc.expiration_date || 'None'}
                      </td>
                      <td>
                        <span className={status.className}>
                          {status.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleInspect(doc.id)}
                            className="btn-inspect"
                          >
                            Inspect
                          </button>
                          {doc.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReview(doc.id, 'approved')}
                              className="btn-approve"
                            >
                              Approve
                            </button>
                          )}
                          {doc.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReview(doc.id, 'rejected')}
                              className="btn-reject"
                            >
                              Reject
                            </button>
                          )}
                        </div>
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
