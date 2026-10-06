import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import SignaturePad from '../../../shared/components/common/SignaturePad';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import EmptyState from '../../../shared/components/common/EmptyState';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import Toast from '../../../shared/components/common/Toast';
import LoadingState from '../../../shared/components/common/LoadingState';
import { admissionPacketUrl, STATE_PACKET_CODE } from '../../../shared/utils/packets';

export default function FormsPage() {
  const { token, user } = useAuth();
  const { data, isLoading: loading, error: fetchError, refetch } = useFetch('/clients/me/agreements', {
    enabled: !!token,
    defaultData: { agreements: [] },
  });
  const agreements = data?.agreements || (Array.isArray(data) ? data : []);

  const [activeKey, setActiveKey] = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  function openSign(tpl) {
    setActiveKey(tpl.agreement_key);
    setSignatureData(null);
    setSignedName(tpl.signed_name || '');
    setErrorMsg('');
  }

  async function handleSign(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!signatureData) {
      setErrorMsg('Please draw your signature.');
      return;
    }
    if (!signedName.trim()) {
      setErrorMsg('Please enter your full legal name to sign.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/clients/me/agreements/${activeKey}/sign`, {
        signature_data: signatureData,
        signed_name: signedName.trim(),
      }, token);
      setToastMsg('Form signed and stored on your record.');
      setActiveKey(null);
      setSignatureData(null);
      await refetch();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to sign the form.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading Client Forms..."
        subtitle="Retrieving electronic agreements..."
        variant="page"
      />
    );
  }

  const signedCount = agreements.filter((a) => a.signed).length;
  const stateCode = STATE_PACKET_CODE[user?.state_id] || 'FL';
  const stateSlug = stateCode.toLowerCase();

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Client Forms & Agreements"
        subtitle="Review and electronically sign agreements required for home care services. Signatures apply directly to your medical record."
        badge={<StatusBadge status={signedCount === agreements.length && agreements.length > 0 ? 'completed' : 'pending'} label={`${signedCount}/${agreements.length} Signed`} />}
        actions={
          <div className="flex gap-2">
            <a
              href={admissionPacketUrl(stateCode)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm text-slate-700"
            >
              Admission Packet (PDF)
            </a>
            <Link to={`/${stateSlug}/forms`} className="btn btn-outline btn-sm text-slate-700">
              State Forms ↗
            </Link>
          </div>
        }
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg || fetchError}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      <Card title={`Required Forms (${signedCount}/${agreements.length} signed)`}>
        {agreements.length === 0 ? (
          <EmptyState
            title="No forms to review at this time"
            description="Your intake documentation and service agreements are fully up to date."
          />
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {agreements.map((tpl) => (
              <div key={tpl.agreement_key} className="border border-base-300 rounded-box p-4 bg-slate-50/50">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 m-0">
                      {tpl.title}
                    </h3>
                    {tpl.signed ? (
                      <p className="text-xs text-slate-500 mt-1 mb-0">
                        Signed by {tpl.signed_name} on {new Date(tpl.signed_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-orange-700 font-medium mt-1 mb-0">
                        Pending signature
                      </p>
                    )}
                  </div>
                  <div>
                    {tpl.signed ? (
                      <StatusBadge status="completed" label="Signed" size="xs" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSign(tpl)}
                        className="btn btn-primary btn-xs"
                      >
                        Review & Sign
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-normal mt-3 mb-0">
                  {tpl.body}
                </p>

                {activeKey === tpl.agreement_key && (
                  <form onSubmit={handleSign} className="border-t border-base-300 mt-4 pt-4 flex flex-col gap-3">
                    <FormField label="Full Legal Name (typed)" htmlFor={`sign-name-${tpl.agreement_key}`} required>
                      <input
                        id={`sign-name-${tpl.agreement_key}`}
                        type="text"
                        required
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder="Enter the signer's full legal name"
                        className="input input-bordered w-full"
                      />
                    </FormField>

                    <FormField label="Draw Signature" required>
                      <div className="border border-base-300 rounded-box p-1 bg-white">
                        <SignaturePad value={signatureData} onChange={setSignatureData} height={140} />
                      </div>
                    </FormField>

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setActiveKey(null); setSignatureData(null); }}
                        className="btn btn-ghost btn-sm text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary btn-sm"
                      >
                        {submitting ? 'Signing...' : 'Sign & Submit Agreement'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
