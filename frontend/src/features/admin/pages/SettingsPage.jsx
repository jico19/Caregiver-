import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';

export default function SettingsPage() {
  const { token } = useAuth();
  const [message, setMessage] = useState(null);
  const queryClient = useQueryClient();

  const {
    data: reqsData,
    isLoading: loading,
    error,
  } = useFetch('/admin/settings/document-requirements', { enabled: !!token });

  const requirements = reqsData?.requirements || (Array.isArray(reqsData) ? reqsData : []);

  const updateRequirement = useMutation({
    mutationFn: ({ reqId, required }) =>
      api.put(
        '/admin/settings/document-requirements',
        {
          requirement_id: reqId,
          required,
          reason: 'Updated via state compliance settings dashboard',
        },
        token
      ),
    onMutate: () => setMessage(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['/admin/settings/document-requirements'],
      });
      setMessage({ type: 'success', text: 'Document requirement updated successfully.' });
    },
    onError: (err) => {
      setMessage({
        type: 'error',
        text: err.detail || err.message || 'Failed to update requirement.',
      });
    }
  });

  function handleToggleRequired(reqId, currentRequired) {
    updateRequirement.mutate({ reqId, required: !currentRequired });
  }

  const caregiverReqs = requirements.filter(
    (r) => (r.document_types?.for_role || r.for_role) === 'caregiver'
  );
  const clientReqs = requirements.filter(
    (r) => (r.document_types?.for_role || r.for_role) === 'client'
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            State Compliance Document Settings
          </h1>
          <p className="page-subtitle">
            Configure mandatory credential and intake document requirements per role for your state office.
          </p>
        </div>
      </div>

      {message && (
        <div role="alert" className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message.text}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">
          <div className="table-loading-sm">Loading state document requirements matrix...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Caregiver Requirements */}
          <div className="admin-card">
            <div className="border-b pb-3 mb-4">
              <h2 className="section-title text-lg font-bold">
                Caregiver Credential Requirements
              </h2>
              <p className="text-sm text-gray-500">
                Mandatory document submissions required for caregiver compliance and active status.
              </p>
            </div>

            {caregiverReqs.length === 0 ? (
              <div className="table-empty-sm">No caregiver document requirements configured.</div>
            ) : (
              <div className="table-responsive">
                <table className="table-admin">
                  <thead>
                    <tr>
                      <th>Document Type</th>
                      <th>Description</th>
                      <th>Expires Required</th>
                      <th>State</th>
                      <th className="text-right">Requirement Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caregiverReqs.map((req) => {
                      const docType = req.document_types || {};
                      const stateInfo = req.states || {};
                      const isToggling = updateRequirement.isPending && updateRequirement.variables?.reqId === req.id;

                      return (
                        <tr key={req.id}>
                          <td className="cell-strong">
                            {docType.name || req.document_type_id}
                          </td>
                          <td className="cell-muted text-sm">
                            {docType.description || 'Standard credential document'}
                          </td>
                          <td className="cell-muted">
                            {docType.requires_expiration ? 'Yes' : 'No'}
                          </td>
                          <td className="cell-muted font-medium">
                            {stateInfo.code || 'FL'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleToggleRequired(req.id, req.required)}
                              disabled={updateRequirement.isPending}
                              className={`btn-sm ${req.required ? 'btn-danger' : 'btn-secondary'}`}
                            >
                              {isToggling ? 'Updating...' : req.required ? 'Mandatory (Click to make optional)' : 'Optional (Click to make mandatory)'}
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

          {/* Client Requirements */}
          <div className="admin-card">
            <div className="border-b pb-3 mb-4">
              <h2 className="section-title text-lg font-bold">
                Client Intake & Compliance Requirements
              </h2>
              <p className="text-sm text-gray-500">
                Mandatory authorizations and agreements required for client intake completion.
              </p>
            </div>

            {clientReqs.length === 0 ? (
              <div className="table-empty-sm">No client document requirements configured.</div>
            ) : (
              <div className="table-responsive">
                <table className="table-admin">
                  <thead>
                    <tr>
                      <th>Document Type</th>
                      <th>Description</th>
                      <th>Expires Required</th>
                      <th>State</th>
                      <th className="text-right">Requirement Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientReqs.map((req) => {
                      const docType = req.document_types || {};
                      const stateInfo = req.states || {};
                      const isToggling = updateRequirement.isPending && updateRequirement.variables?.reqId === req.id;

                      return (
                        <tr key={req.id}>
                          <td className="cell-strong">
                            {docType.name || req.document_type_id}
                          </td>
                          <td className="cell-muted text-sm">
                            {docType.description || 'Standard intake agreement'}
                          </td>
                          <td className="cell-muted">
                            {docType.requires_expiration ? 'Yes' : 'No'}
                          </td>
                          <td className="cell-muted font-medium">
                            {stateInfo.code || 'FL'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleToggleRequired(req.id, req.required)}
                              disabled={updateRequirement.isPending}
                              className={`btn-sm ${req.required ? 'btn-danger' : 'btn-secondary'}`}
                            >
                              {isToggling ? 'Updating...' : req.required ? 'Mandatory (Click to make optional)' : 'Optional (Click to make mandatory)'}
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
      )}
    </div>
  );
}
