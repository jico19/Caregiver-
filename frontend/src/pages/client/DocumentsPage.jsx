import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function DocumentsPage() {
  const { token } = useAuth();

  const [docTypes, setDocTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload state
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);

  const [docStatus, setDocStatus] = useState(null);
  const selectedTypeObj = docTypes.find((t) => String(t.id) === String(selectedTypeId));

  useEffect(() => {
    let isMounted = true;

    async function loadClientDocs() {
      try {
        const [typesRes, docsRes, statusRes] = await Promise.all([
          api.get('/documents/types?role=client', token),
          api.get('/documents/me', token),
          api.get('/clients/me/document-status', token),
        ]);

        if (!isMounted) return;
        const types = typesRes?.document_types || [];
        setDocTypes(types);
        if (types.length > 0) setSelectedTypeId(String(types[0].id));
        setDocuments(docsRes?.documents || []);
        setDocStatus(statusRes || null);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load document records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadClientDocs();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleUploadSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedFile) {
      setErrorMsg('Please select a file to submit.');
      return;
    }

    if (selectedTypeObj?.requires_expiration && !expirationDate) {
      setErrorMsg(`An expiration date is required for ${selectedTypeObj.name}.`);
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('document_type_id', selectedTypeId);
    if (expirationDate) {
      formData.append('expiration_date', expirationDate);
    }

    try {
      await api.upload('/documents/upload', formData, token);
      setSuccessMsg(`Document '${selectedFile.name}' received and queued for administrative review.`);
      setSelectedFile(null);
      setExpirationDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit document. Ensure file is under 10 MB in PDF, JPEG, or PNG format.');
      setUploading(false);
      return;
    }

    try {
      const [docsRes, statusRes] = await Promise.all([
        api.get('/documents/me', token),
        api.get('/clients/me/document-status', token),
      ]);
      setDocuments(docsRes?.documents || []);
      setDocStatus(statusRes || null);
    } catch (err) {
      setErrorMsg('Upload succeeded, but the document list could not be refreshed. Please reload the page.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(docId) {
    try {
      const res = await api.get(`/documents/${docId}/download-url`, token);
      if (res?.download_url) {
        window.open(res.download_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err.detail || 'Could not retrieve download link. Please refresh.');
    }
  }

  if (loading) {
    return <div className="loading-text">Loading client documents...</div>;
  }

  const statusBadge = {
    pending_review: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    expired: 'badge-gray',
  };

  const statusLabel = {
    pending_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Action Needed',
    expired: 'Expired',
  };

  return (
    <div className="container-wide">
      <div className="page-head">
        <h1 className="page-title">
          Client Medical & Care Documents
        </h1>
        <p className="page-subtitle">
          Submit insurance cards, Medicaid enrollment documents, and physician treatment plans.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {/* Requirements Panel */}
      {docStatus && (
        <div className="card mb-8">
          <h2 className="section-title-bordered">
            State Document Requirements
          </h2>
          <div className="grid grid-cols-4 max-md:grid-cols-1 gap-3 mb-4">
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Missing Documents</span>
              <strong className={`text-lg ${docStatus.summary?.missing > 0 ? 'text-red' : 'text-green'}`}>
                {docStatus.summary?.missing || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Expired</span>
              <strong className={`text-lg ${docStatus.summary?.expired > 0 ? 'text-red' : 'text-green'}`}>
                {docStatus.summary?.expired || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Expiring Soon</span>
              <strong className="text-lg text-yellow">
                {docStatus.summary?.expiring_soon || 0}
              </strong>
            </div>
            <div className="p-3 bg-subtle rounded border">
              <span className="text-xs text-secondary block">Compliance Status</span>
              <strong className={`text-sm ${docStatus.summary?.compliant ? 'text-green' : 'text-red'}`}>
                {docStatus.summary?.compliant ? 'Compliant' : 'Action Required'}
              </strong>
            </div>
          </div>
          {docStatus.required_types?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-secondary block mb-2">Required for your state:</span>
              <div className="flex flex-wrap gap-2">
                {docStatus.required_types.map((rt) => {
                  const isMissing = docStatus.missing?.some((m) => m.document_type_id === rt.document_type_id);
                  return (
                    <span key={rt.document_type_id} className={`badge ${isMissing ? 'badge-red' : 'badge-green'}`}>
                      {rt.name} {isMissing ? '(Missing)' : '(Uploaded)'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Box */}
      <div className="card mb-8">
        <h2 className="section-title-bordered">
          Submit Document
        </h2>

        <form onSubmit={handleUploadSubmit} className="grid grid-cols-4 max-md:grid-cols-1 gap-4 items-end">
          <div>
            <label htmlFor="client-doc-type">
              Document Type *
            </label>
            <select
              id="client-doc-type"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
            >
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="client-expiration-date">
              Expiration Date {selectedTypeObj?.requires_expiration ? '*' : '(if applicable)'}
            </label>
            <input
              id="client-expiration-date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="client-file">
              File (PDF, PNG, JPEG, max 10MB) *
            </label>
            <input
              id="client-file"
              ref={fileInputRef}
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="text-sm"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={uploading}
              className="btn-success btn-full"
            >
              {uploading ? 'Submitting...' : 'Upload File'}
            </button>
          </div>
        </form>
      </div>

      {/* Documents Table */}
      <div className="card">
        <h2 className="section-title">
          Document Records ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <div className="card-empty-compact">
            <p>No documents recorded yet.</p>
            <p className="text-sm text-muted mt-2">
              Upload your Insurance Card, Medicaid card, or Physician Orders above.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Uploaded Date</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const badge = statusBadge[doc.status] || statusBadge.pending_review;
                  const label = statusLabel[doc.status] || statusLabel.pending_review;
                  return (
                    <tr key={doc.id}>
                      <td className="font-medium">
                        {doc.document_types?.name || 'Document'}
                      </td>
                      <td className="text-secondary">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="text-secondary">
                        {doc.expiration_date ? new Date(doc.expiration_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id)}
                          className="btn-ghost-download"
                        >
                          View File
                        </button>
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