import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SignaturePad from '../../components/common/SignaturePad';
import { admissionPacketUrl, ADMISSION_PACKET_ITEMS, STATE_PACKET_CODE } from '../../utils/packets';

export default function IntakePage() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [stateId, setStateId] = useState(user?.state_id ? String(user.state_id) : '1');

  // E-signature
  const [signatureData, setSignatureData] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [packetOpen, setPacketOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadClientData() {
      try {
        const res = await api.get('/clients/me', token);
        if (!isMounted) return;

        if (res?.profile) {
          const p = res.profile;
          setFirstName(p.first_name || '');
          setLastName(p.last_name || '');
          setDateOfBirth(p.date_of_birth || '');
          setPhone(p.phone || '');
          setAddress(p.address || '');
          setMedicaidNumber(p.medicaid_number || '');
          if (p.state_id) setStateId(String(p.state_id));
          setSignedName(p.signed_name || `${p.first_name || ''} ${p.last_name || ''}`.trim());
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load existing intake records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadClientData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!signatureData) {
      setErrorMsg('Please draw your signature to confirm the intake information.');
      return;
    }
    if (!signedName.trim()) {
      setErrorMsg('Please enter your full legal name to sign.');
      return;
    }
    setSubmitting(true);

    const payload = {
      state_id: parseInt(stateId, 10),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      medicaid_number: medicaidNumber.trim() || null,
      signature_data: signatureData,
      signed_name: signedName.trim(),
    };

    try {
      await api.post('/clients/intake', payload, token);
      setSuccessMsg('Your intake information has been recorded and signed successfully. An intake coordinator will reach out to assess your care requirements.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit client intake. Please verify your information.');
    } finally {
      setSubmitting(false);
    }
  }

  const stateCode = STATE_PACKET_CODE[stateId] || STATE_PACKET_CODE[1];
  const admissionItems = ADMISSION_PACKET_ITEMS[stateCode];

  if (loading) {
    return <div className="loading-text">Loading client intake profile...</div>;
  }

  return (
    <div className="container-medium">
      <div className="page-head">
        <h1 className="page-title">
          Client Service Intake
        </h1>
        <p className="page-subtitle">
          Provide the care recipient's identification and Medicaid details to initiate authorization and scheduling.
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

      <form onSubmit={handleSubmit} className="form-card">
        <h2 className="section-title-bordered">
          Care Recipient Information
        </h2>

        <div className="form-grid-2">
          <div>
            <label htmlFor="client-first-name">
              First Name *
            </label>
            <input
              id="client-first-name"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="client-last-name">
              Last Name *
            </label>
            <input
              id="client-last-name"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="client-state">
              Service State *
            </label>
            <select
              id="client-state"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
            >
              <option value="1">Florida (FL)</option>
              <option value="2">Indiana (IN)</option>
              <option value="3">Georgia (GA)</option>
            </select>
          </div>

          <div>
            <label htmlFor="client-dob">
              Date of Birth
            </label>
            <input
              id="client-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="client-phone">
              Primary Phone
            </label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>

          <div>
            <label htmlFor="client-medicaid">
              Medicaid or Insurance Number
            </label>
            <input
              id="client-medicaid"
              type="text"
              value={medicaidNumber}
              onChange={(e) => setMedicaidNumber(e.target.value)}
              placeholder="E.g., 9-digit Medicaid ID"
            />
          </div>
        </div>

        <div>
          <label htmlFor="client-address">
            Service Address (Home Location)
          </label>
          <input
            id="client-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, City, State, ZIP"
          />
        </div>

        <div className="admission-packet-card">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h3 className="section-title m-0">
                Client Admission Packet
              </h3>
              <p className="text-sm text-muted mt-1">
                Review the forms included in this state's admission packet before signing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPacketOpen(!packetOpen)}
              className="btn-outline-secondary"
            >
              {packetOpen ? 'Hide forms' : 'View included forms'}
            </button>
          </div>

          {packetOpen && (
            <ul className="list-disc pl-5 mt-3 text-sm text-secondary">
              {admissionItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}

          <a
            href={admissionPacketUrl(stateId)}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="btn-success mt-4 inline-flex items-center gap-2"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v13m0 0l-4-4m4 4l4-4" /></svg>
            Download {stateId === '2' ? 'Indiana' : stateId === '3' ? 'Georgia' : 'Florida'} Admission Packet (PDF)
          </a>
        </div>

        <h2 className="section-title-bordered">
          Client Acknowledgement & Signature
        </h2>
        <p className="text-sm text-muted">
          By signing below, you confirm the care recipient information above is accurate and acknowledge receipt of the admission packet.
        </p>

        <div>
          <label htmlFor="client-signed-name">
            Full Legal Name (typed) *
          </label>
          <input
            id="client-signed-name"
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
          <SignaturePad value={signatureData} onChange={setSignatureData} height={180} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-success-full"
        >
          {submitting ? 'Saving Intake...' : 'Sign & Submit Intake'}
        </button>
      </form>

      <div className="flex justify-end mt-6">
        <Link to="/client/documents" className="text-success text-sm font-medium">
          Go to Document Submission →
        </Link>
      </div>
    </div>
  );
}