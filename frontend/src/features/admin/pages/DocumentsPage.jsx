import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import { queryClient } from '../../../shared/lib/queryClient';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import Pagination from '../../../shared/components/common/Pagination';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';
import { DOCUMENT_STATUS_META } from '../../../shared/constants/documentStatus';
import { downloadDocument } from '../../../shared/utils/documentUtils';

export default function DocumentsPage() {
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const {
    items: documents,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setItems,
    setPage,
    setPageSize,
  } = usePaginatedFetch({
    url: '/admin/documents',
    token,
    params: { status: statusFilter },
    listKey: 'documents',
  });

  async function handleReview(docId, newStatus) {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(docId);

    try {
      await api.post(`/admin/documents/${docId}/review`, { status: newStatus }, token);
      setSuccessMsg(`Document marked as ${newStatus}.`);
      setItems((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: newStatus } : d))
      );
      queryClient.invalidateQueries({ queryKey: ['paginated', '/admin/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/admin/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/caregivers/me/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/caregivers/me/credential-status'] });
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update document status.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleInspect(docId) {
    downloadDocument(docId, token);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Document Compliance & Verification"
        subtitle="Verify credentials, CPR certifications, background screening, and physician plans across state offices."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="filter-doc-status" className="text-xs font-semibold text-slate-700">
              Status:
            </label>
            <select
              id="filter-doc-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select select-bordered select-xs text-xs"
            >
              <option value="all">All Documents</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        }
      />

      {(error || errorMsg) && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{error || errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{successMsg}</span>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading document queue...</div>
        ) : documents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No documents found"
              description="No documents found matching the filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
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
                  const s = DOCUMENT_STATUS_META[doc.status] || DOCUMENT_STATUS_META.pending_review;
                  const isBusy = actionLoading === doc.id;

                  return (
                    <tr key={doc.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                      <td className="font-semibold text-slate-900 text-xs">
                        {doc.document_types?.name || 'Document'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {doc.users?.email || doc.owner_id?.slice(0, 8)}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {doc.states?.code || 'FL'}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="text-slate-600 text-xs">
                        {doc.expiration_date || 'None'}
                      </td>
                      <td>
                        <StatusBadge status={doc.status} label={s.label} />
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1.5 items-center">
                          <button
                            type="button"
                            onClick={() => handleInspect(doc.id)}
                            className="btn btn-outline btn-xs"
                          >
                            Inspect
                          </button>
                          {doc.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReview(doc.id, 'approved')}
                              className="btn btn-primary btn-xs"
                            >
                              Approve
                            </button>
                          )}
                          {doc.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReview(doc.id, 'rejected')}
                              className="btn btn-ghost btn-xs text-red-600 hover:bg-red-50 border border-red-200"
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

        <div className="p-3 border-t border-base-300">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            listLabel="documents"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </PageContainer>
  );
}
