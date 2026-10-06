import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import { DOCUMENT_STATUS_META } from '../../../shared/constants/documentStatus';
import { downloadDocument } from '../../../shared/utils/documentUtils';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';

export default function DocumentsPage() {
  const { token } = useAuth();

  const { data: typesData } = useFetch('/documents/types', {
    params: { role: 'caregiver' },
    enabled: !!token,
    staleTime: Infinity,
    defaultData: { document_types: [] },
  });
  const docTypes = typesData?.document_types || [];

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload form state
  const [selectedTypeIdState, setSelectedTypeId] = useState('');
  const selectedTypeId = selectedTypeIdState || (docTypes[0]?.id ? String(docTypes[0].id) : '');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDocumentsData() {
      try {
        const docsRes = await api.get('/documents/me', token);
        if (!isMounted) return;
        setDocuments(docsRes?.documents || []);
      } catch {
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
      await api.upload('/documents/upload', formData, token);
      setSuccessMsg(`Document '${selectedFile.name}' uploaded successfully and submitted for review.`);
      setSelectedFile(null);
      setExpirationDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to upload document. Ensure file is under 10 MB in PDF, JPEG, or PNG format.');
      setUploading(false);
      return;
    }

    try {
      const docsRes = await api.get('/documents/me', token);
      setDocuments(docsRes?.documents || []);
    } catch {
      setErrorMsg('Upload succeeded, but the document list could not be refreshed. Please reload the page.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <PageContainer size="wide">
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading document records...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Caregiver Credentials & Compliance"
        subtitle="Upload required professional certifications and state background check records. All files are securely encrypted."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload Section */}
      <Card className="mb-6">
        <h2 className="font-semibold text-base text-slate-900 m-0 mb-4 pb-2 border-b border-base-300">
          Upload New Credential or Form
        </h2>

        <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <FormField label="Document Category" id="doc-type" required>
            <select
              id="doc-type"
              className="select select-bordered w-full text-sm"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
            >
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.requires_expiration ? '(Expiration Required)' : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label={`Expiration Date ${selectedTypeObj?.requires_expiration ? '*' : '(Optional)'}`}
            id="expiration-date"
            required={selectedTypeObj?.requires_expiration}
          >
            <input
              id="expiration-date"
              type="date"
              required={selectedTypeObj?.requires_expiration}
              className="input input-bordered w-full text-sm"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </FormField>

          <FormField label="File (PDF, PNG, JPEG, max 10MB)" id="doc-file" required>
            <input
              id="doc-file"
              type="file"
              ref={fileInputRef}
              required
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="file-input file-input-bordered file-input-sm w-full text-xs"
            />
          </FormField>

          <div>
            <button
              type="submit"
              disabled={uploading}
              className="btn btn-primary w-full"
            >
              {uploading ? 'Uploading...' : 'Submit Credential'}
            </button>
          </div>
        </form>
      </Card>

      {/* Uploaded Documents List */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-base-300">
          <h2 className="font-semibold text-base text-slate-900 m-0">
            Submitted Documents ({documents.length})
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No documents uploaded yet"
              description="Select a category above to submit your driver license, CPR certification, or TB test."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                  <th>Document Type</th>
                  <th>Uploaded Date</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const s = DOCUMENT_STATUS_META[doc.status] || DOCUMENT_STATUS_META.pending_review;
                  return (
                    <tr key={doc.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                      <td className="font-semibold text-slate-900 text-xs">
                        {doc.document_types?.name || 'Document'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {doc.expiration_date ? new Date(doc.expiration_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <StatusBadge status={doc.status} label={s.label} />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => downloadDocument(doc.id, token)}
                          className="btn btn-outline btn-xs"
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
      </Card>
    </PageContainer>
  );
}
