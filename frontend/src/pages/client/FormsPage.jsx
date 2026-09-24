import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SignaturePad from '../../components/common/SignaturePad';
import { admissionPacketUrl, STATE_PACKET_CODE } from '../../utils/packets';

export default function FormsPage() {
  const { token, user } = useAuth();

  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadAgreements() {
      try {
        const res = await api.get('/clients/me/agreements', token);
        if (!isMounted) return;
        setAgreements(res?.agreements || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load client forms.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadAgreements();
    return () => {
      isMounted = false;
    };
  }, [token]);

  function openSign(tpl) {
    setActiveKey(tpl.agreement_key);
    setSignatureData(null);
    setSignedName(tpl.signed_name || '');
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function handleSign(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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
      setSuccessMsg('Form signed and stored on your record.');
      setActiveKey(null);
      setSignatureData(null);

      const res = await api.get('/clients/me/agreements', token);
      setAgreements(res?.agreements || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to sign the form.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="loading-text">Loading client forms...</div>;
  }

  const signedCount = agreements.filter((a) => a.signed).length;
  const stateCode = STATE_PACKET_CODE[user?.state_id] || 'FL';
  const stateSlug = stateCode.toLowerCase();

  return (
    <div className="container-medium">
      <div className="page-head">
        <h1 className="page-title">
          Client Forms & Agreements
        </h1>
        <p className="page-subtitle">
          Review and electronically sign the agreements required for your home care services. Signatures apply your name on its own behalf.
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
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="section-title m-0">
              Admission Packet & State Forms
            </h2>
            <p className="text-sm text-muted mt-1">
              Download the state admission packet and view regulatory forms for your service state.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={admissionPacketUrl(stateCode)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-secondary"
            >
              Admission Packet (PDF)
            </a>
            <Link to={`/${stateSlug}/forms`} className="btn-outline-primary">
              State Forms
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title m-0">
            Required Forms ({signedCount}/{agreements.length} signed)
          </h2>
        </div>

        {agreements.length === 0 ? (
          <div className="card-empty">
            No forms to review at this time.
          </div>
        ) : (
          <div className="grid gap-4">
            {agreements.map((tpl) => (
              <div key={tpl.agreement_key} className="border rounded-lg p-5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {tpl.title}
                    </h3>
                    {tpl.signed ? (
                      <p className="text-xs text-muted mt-1">
                        Signed by {tpl.signed_name} on {new Date(tpl.signed_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-[#b45309] mt-1">
                        Not signed yet
                      </p>
                    )}
                  </div>
                  {tpl.signed ? (
                    <span className="badge badge-green">Signed</span>
                  ) : (
                    <button type="button" onClick={() => openSign(tpl)} className="btn-outline-secondary">
                      Review & Sign
                    </button>
                  )}
                </div>

                <p className="text-sm text-muted leading-normal mt-3">
                  {tpl.body}
                </p>

                {activeKey === tpl.agreement_key && (
                  <form onSubmit={handleSign} className="border-t mt-4 pt-4">
                    <div>
                      <label htmlFor={`sign-name-${tpl.agreement_key}`}>
                        Full Legal Name (typed) *
                      </label>
                      <input
                        id={`sign-name-${tpl.agreement_key}`}
                        type="text"
                        required
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder="Enter the signer's full legal name"
                      />
                    </div>
                    <div>
                      <label>
                        Draw Signature *
                      </label>
                      <SignaturePad value={signatureData} onChange={setSignatureData} height={150} />
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => { setActiveKey(null); setSignatureData(null); }}
                        className="btn-cancel"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-success"
                      >
                        {submitting ? 'Signing...' : 'Sign & Submit'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}