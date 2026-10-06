import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import EmptyState from '../../../shared/components/common/EmptyState';
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
    <PageContainer>
      <PageHeader
        title="State Compliance Document Settings"
        description="Configure mandatory credential and intake document requirements per role for your state office."
      />

      {message && (
        <div role="alert" className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 text-sm py-2 px-4 rounded-box`}>
          {message.text}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-slate-500 text-sm">
          Loading state document requirements matrix...
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Caregiver Requirements */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-base-200">
              <h2 className="text-sm font-semibold text-slate-900 m-0">
                Caregiver Credential Requirements
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mandatory document submissions required for caregiver compliance and active status.
              </p>
            </div>

            {caregiverReqs.length === 0 ? (
              <EmptyState title="No requirements configured" message="No caregiver document requirements configured." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                      <th>Document Type</th>
                      <th>Description</th>
                      <th>Expires Required</th>
                      <th>State</th>
                      <th className="text-right">Requirement Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200 text-sm">
                    {caregiverReqs.map((req) => {
                      const docType = req.document_types || {};
                      const stateInfo = req.states || {};
                      const isToggling = updateRequirement.isPending && updateRequirement.variables?.reqId === req.id;

                      return (
                        <tr key={req.id} className="hover:bg-base-200/40 transition-colors">
                          <td className="font-medium text-slate-900">
                            {docType.name || req.document_type_id}
                          </td>
                          <td className="text-slate-600 text-xs max-w-xs">
                            {docType.description || 'Standard credential document'}
                          </td>
                          <td className="text-slate-500 text-xs">
                            {docType.requires_expiration ? 'Yes' : 'No'}
                          </td>
                          <td>
                            <span className="badge badge-sm badge-ghost font-medium">
                              {stateInfo.code || 'FL'}
                            </span>
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              onClick={() => handleToggleRequired(req.id, req.required)}
                              disabled={updateRequirement.isPending}
                              className={`btn btn-xs ${
                                req.required
                                  ? 'btn-error btn-outline'
                                  : 'btn-ghost border border-base-300'
                              }`}
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
          </Card>

          {/* Client Requirements */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-base-200">
              <h2 className="text-sm font-semibold text-slate-900 m-0">
                Client Intake & Compliance Requirements
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mandatory authorizations and agreements required for client intake completion.
              </p>
            </div>

            {clientReqs.length === 0 ? (
              <EmptyState title="No requirements configured" message="No client document requirements configured." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                      <th>Document Type</th>
                      <th>Description</th>
                      <th>Expires Required</th>
                      <th>State</th>
                      <th className="text-right">Requirement Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200 text-sm">
                    {clientReqs.map((req) => {
                      const docType = req.document_types || {};
                      const stateInfo = req.states || {};
                      const isToggling = updateRequirement.isPending && updateRequirement.variables?.reqId === req.id;

                      return (
                        <tr key={req.id} className="hover:bg-base-200/40 transition-colors">
                          <td className="font-medium text-slate-900">
                            {docType.name || req.document_type_id}
                          </td>
                          <td className="text-slate-600 text-xs max-w-xs">
                            {docType.description || 'Standard intake agreement'}
                          </td>
                          <td className="text-slate-500 text-xs">
                            {docType.requires_expiration ? 'Yes' : 'No'}
                          </td>
                          <td>
                            <span className="badge badge-sm badge-ghost font-medium">
                              {stateInfo.code || 'FL'}
                            </span>
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              onClick={() => handleToggleRequired(req.id, req.required)}
                              disabled={updateRequirement.isPending}
                              className={`btn btn-xs ${
                                req.required
                                  ? 'btn-error btn-outline'
                                  : 'btn-ghost border border-base-300'
                              }`}
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
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
