import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import { downloadDocument } from '../../../shared/utils/documentUtils';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import DataTable from '../../../shared/components/common/DataTable';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import Toast from '../../../shared/components/common/Toast';
import LoadingState from '../../../shared/components/common/LoadingState';

export default function DocumentsPage() {
  const { token } = useAuth();

  const { data: typesData } = useFetch('/documents/types', {
    params: { role: 'client' },
    enabled: !!token,
    staleTime: Infinity,
    defaultData: { document_types: [] },
  });
  const docTypes = typesData?.document_types || [];

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Upload state
  const [selectedTypeIdState, setSelectedTypeId] = useState('');
  const selectedTypeId = selectedTypeIdState || (docTypes[0]?.id ? String(docTypes[0].id) : '');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);
  const [docStatus, setDocStatus] = useState(null);
  const selectedTypeObj = docTypes.find((t) => String(t.id) === String(selectedTypeId));

  useEffect(() => {
    let isMounted = true;

    async function loadClientDocs() {
      try {
        const [docsRes, statusRes] = await Promise.all([
          api.get('/documents/me', token),
          api.get('/clients/me/document-status', token),
        ]);

        if (!isMounted) return;
        setDocuments(docsRes?.documents || []);
        setDocStatus(statusRes || null);
      } catch {
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
    setToastMsg('');

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
      setToastMsg(`Document '${selectedFile.name}' received and queued for administrative review.`);
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
    } catch {
      setErrorMsg('Upload succeeded, but the document list could not be refreshed. Please reload the page.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading Client Documents..."
        subtitle="Retrieving medical records and compliance files..."
        variant="page"
      />
    );
  }

  const columns = [
    {
      key: 'name',
      label: 'Document Type',
      render: (_, row) => <span className="font-semibold text-slate-900">{row.document_types?.name || 'Document'}</span>,
    },
    {
      key: 'uploaded_at',
      label: 'Uploaded Date',
      render: (val) => <span className="text-slate-600">{new Date(val).toLocaleDateString()}</span>,
    },
    {
      key: 'expiration_date',
      label: 'Expiration',
      render: (val) => <span className="text-slate-600">{val ? new Date(val).toLocaleDateString() : 'N/A'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} size="xs" />,
    },
    {
      key: 'actions',
      label: '',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => downloadDocument(row.id, token)}
          className="btn btn-ghost btn-xs text-green-700 hover:text-green-800 font-semibold"
        >
          View File ↓
        </button>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Client Medical & Care Documents"
        subtitle="Submit insurance cards, Medicaid enrollment documents, and physician treatment plans."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      {/* Requirements Panel */}
      {docStatus && (
        <Card title="State Document Requirements" className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Missing</span>
              <strong className={`text-base font-bold ${docStatus.summary?.missing > 0 ? 'text-error' : 'text-green-700'}`}>
                {docStatus.summary?.missing || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Expired</span>
              <strong className={`text-base font-bold ${docStatus.summary?.expired > 0 ? 'text-error' : 'text-green-700'}`}>
                {docStatus.summary?.expired || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Expiring Soon</span>
              <strong className="text-base font-bold text-orange-600">
                {docStatus.summary?.expiring_soon || 0}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-base-300">
              <span className="text-xs text-slate-500 block">Compliance</span>
              <StatusBadge
                status={docStatus.summary?.compliant ? 'completed' : 'error'}
                label={docStatus.summary?.compliant ? 'Compliant' : 'Action Required'}
                size="xs"
              />
            </div>
          </div>

          {docStatus.required_types?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2">Required for your jurisdiction:</span>
              <div className="flex flex-wrap gap-2">
                {docStatus.required_types.map((rt) => {
                  const isMissing = docStatus.missing?.some((m) => m.document_type_id === rt.document_type_id);
                  return (
                    <StatusBadge
                      key={rt.document_type_id}
                      status={isMissing ? 'error' : 'success'}
                      label={`${rt.name} ${isMissing ? '(Missing)' : '(Uploaded)'}`}
                      size="xs"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Upload Card */}
      <Card title="Submit Document" className="mb-6">
        <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mt-2">
          <FormField label="Document Type" htmlFor="client-doc-type" required>
            <select
              id="client-doc-type"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="select select-bordered w-full"
            >
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label={`Expiration ${selectedTypeObj?.requires_expiration ? '*' : '(optional)'}`}
            htmlFor="client-expiration-date"
          >
            <input
              id="client-expiration-date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="input input-bordered w-full"
            />
          </FormField>

          <FormField label="File (PDF, PNG, JPG < 10MB)" htmlFor="client-file" required>
            <input
              id="client-file"
              ref={fileInputRef}
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="file-input file-input-bordered file-input-sm w-full"
            />
          </FormField>

          <div>
            <button
              type="submit"
              disabled={uploading}
              className="btn btn-primary btn-sm w-full"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </form>
      </Card>

      {/* Document Records */}
      <Card title={`Document Records (${documents.length})`}>
        {documents.length === 0 ? (
          <EmptyState
            title="No documents recorded yet"
            description="Upload your Insurance Card, Medicaid card, or Physician Orders above."
          />
        ) : (
          <DataTable
            columns={columns}
            data={documents}
            keyField="id"
          />
        )}
      </Card>
    </PageContainer>
  );
}
