import { useState, useEffect } from 'react';
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

  // Upload form state
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDocumentsData() {
      try {
        const [typesRes, docsRes] = await Promise.all([
          api.get('/documents/types?role=caregiver', token),
          api.get('/documents/me', token),
        ]);

        if (!isMounted) return;
        const types = typesRes?.document_types || [];
        setDocTypes(types);
        if (types.length > 0) setSelectedTypeId(String(types[0].id));
        setDocuments(docsRes?.documents || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load credentials and required document types.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadDocumentsData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const selectedTypeObj = docTypes.find((t) => String(t.id) === String(selectedTypeId));

  async function handleUploadSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedFile) {
      setErrorMsg('Please select a file to upload.');
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
      const res = await api.upload('/documents/upload', formData, token);
      setSuccessMsg(`Document '${selectedFile.name}' uploaded successfully and submitted for review.`);
      setSelectedFile(null);
      setExpirationDate('');
      // Refresh documents list
      const docsRes = await api.get('/documents/me', token);
      setDocuments(docsRes?.documents || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to upload document. Ensure file is under 10 MB in PDF, JPEG, or PNG format.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(docId, docName) {
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
    return <div className="loading-screen">Loading document records...</div>;
  }

  const statusMap = {
    pending_review: { badge: 'badge-yellow', label: 'Pending Review' },
    approved: { badge: 'badge-green', label: 'Approved' },
    rejected: { badge: 'badge-red', label: 'Rejected' },
    expired: { badge: 'badge-gray', label: 'Expired' },
  };

  return (
    <div className="container-wide">
      <div className="mb-6">
        <h1 className="page-title">
          Caregiver Credentials & Compliance
        </h1>
        <p className="page-subtitle">
          Upload required professional certifications and state background check records. All files are securely encrypted.
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

      {/* Upload Section */}
      <div className="card mb-8">
        <h2 className="section-title-bordered">
          Upload New Credential or Form
        </h2>

        <form onSubmit={handleUploadSubmit} className="grid grid-cols-4 max-md:grid-cols-1 gap-4 items-end">
          <div>
            <label htmlFor="doc-type">
              Document Category *
            </label>
            <select
              id="doc-type"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
            >
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.requires_expiration ? '(Expiration Required)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expiration-date">
              Expiration Date {selectedTypeObj?.requires_expiration ? '*' : '(Optional)'}
            </label>
            <input
              id="expiration-date"
              type="date"
              required={selectedTypeObj?.requires_expiration}
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="doc-file">
              File (PDF, PNG, JPEG, max 10MB) *
            </label>
            <input
              id="doc-file"
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
              className="btn-primary btn-full"
            >
              {uploading ? 'Uploading...' : 'Submit Credential'}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Documents List */}
      <div className="card">
        <h2 className="section-title">
          Submitted Documents ({documents.length})
        </h2>

        {documents.length === 0 ? (
          <div className="card-dashed">
            <p className="font-semibold">No documents uploaded yet.</p>
            <p className="text-sm text-muted mt-2">
              Select a category above to submit your driver license, CPR certification, or TB test.
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
                  const s = statusMap[doc.status] || statusMap.pending_review;
                  return (
                    <tr key={doc.id}>
                      <td className="font-semibold">
                        {doc.document_types?.name || 'Document'}
                      </td>
                      <td className="text-secondary">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="text-secondary">
                        {doc.expiration_date ? new Date(doc.expiration_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${s.badge}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id, doc.document_types?.name)}
                          className="btn-outline-primary btn-sm"
                        >
                          View / Download
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
