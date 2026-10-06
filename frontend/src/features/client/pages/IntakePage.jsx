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
import LoadingState from '../../../shared/components/common/LoadingState';
import { admissionPacketUrl, ADMISSION_PACKET_ITEMS, STATE_PACKET_CODE } from '../../../shared/utils/packets';

export default function IntakePage() {
  const { token, user } = useAuth();

  const { data: profileData, isLoading: loading, error: fetchError } = useFetch('/clients/me', {
    enabled: !!token,
    defaultData: { profile: null },
  });

  if (loading) {
    return (
      <LoadingState
        title="Loading Client Intake Profile..."
        subtitle="Retrieving care recipient identification..."
        variant="page"
      />
    );
  }

  return (
    <ClientIntakeForm
      initialProfile={profileData?.profile}
      token={token}
      user={user}
      fetchError={fetchError}
    />
  );
}

function ClientIntakeForm({ initialProfile, token, user, fetchError }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState(initialProfile?.first_name || '');
  const [lastName, setLastName] = useState(initialProfile?.last_name || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile?.date_of_birth || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [address, setAddress] = useState(initialProfile?.address || '');
  const [medicaidNumber, setMedicaidNumber] = useState(initialProfile?.medicaid_number || '');
  const [stateId, setStateId] = useState(initialProfile?.state_id ? String(initialProfile.state_id) : (user?.state_id ? String(user.state_id) : '1'));

  // E-signature
  const [signatureData, setSignatureData] = useState(null);
  const [signedName, setSignedName] = useState(initialProfile?.signed_name || `${initialProfile?.first_name || ''} ${initialProfile?.last_name || ''}`.trim());
  const [packetOpen, setPacketOpen] = useState(false);

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

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Client Service Intake"
        subtitle="Provide the care recipient's identification and Medicaid details to initiate authorization and scheduling."
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg || fetchError}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-soft alert-success my-4">
          <span className="text-xs">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card title="Care Recipient Information">
          <div className="flex flex-col gap-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="First Name" htmlFor="client-first-name" required>
                <input
                  id="client-first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input input-bordered w-full"
                />
              </FormField>

              <FormField label="Last Name" htmlFor="client-last-name" required>
                <input
                  id="client-last-name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input input-bordered w-full"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Service State" htmlFor="client-state" required>
                <select
                  id="client-state"
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  className="select select-bordered w-full"
                >
                  <option value="1">Florida (FL)</option>
                  <option value="2">Indiana (IN)</option>
                  <option value="3">Georgia (GA)</option>
                </select>
              </FormField>

              <FormField label="Date of Birth" htmlFor="client-dob">
                <input
                  id="client-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="input input-bordered w-full"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Primary Phone" htmlFor="client-phone">
                <input
                  id="client-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="input input-bordered w-full"
                />
              </FormField>

              <FormField label="Medicaid or Insurance Number" htmlFor="client-medicaid">
                <input
                  id="client-medicaid"
                  type="text"
                  value={medicaidNumber}
                  onChange={(e) => setMedicaidNumber(e.target.value)}
                  placeholder="E.g., 9-digit Medicaid ID"
                  className="input input-bordered w-full"
                />
              </FormField>
            </div>

            <FormField label="Service Address (Home Location)" htmlFor="client-address">
              <input
                id="client-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, City, State, ZIP"
                className="input input-bordered w-full"
              />
            </FormField>
          </div>
        </Card>

        <Card
          title="Client Admission Packet"
          subtitle="Review the forms included in this state's admission packet before signing."
        >
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setPacketOpen(!packetOpen)}
              className="btn btn-outline btn-xs text-slate-700"
            >
              {packetOpen ? 'Hide included forms ▲' : 'View included forms ▼'}
            </button>

            {packetOpen && (
              <ul className="list-disc pl-5 mt-3 text-xs text-slate-600 space-y-1">
                {admissionItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}

            <div className="mt-4">
              <a
                href={admissionPacketUrl(stateId)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm text-slate-700 inline-flex items-center gap-2"
              >
                Download {stateId === '2' ? 'Indiana' : stateId === '3' ? 'Georgia' : 'Florida'} Admission Packet (PDF)
              </a>
            </div>
          </div>
        </Card>

        <Card
          title="Client Acknowledgement & Signature"
          subtitle="By signing below, you confirm the care recipient information above is accurate and acknowledge receipt of the admission packet."
        >
          <div className="flex flex-col gap-4 mt-2">
            <FormField label="Full Legal Name (typed)" htmlFor="client-signed-name" required>
              <input
                id="client-signed-name"
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
                <SignaturePad value={signatureData} onChange={setSignatureData} height={180} />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full mt-2"
            >
              {submitting ? 'Saving Intake...' : 'Sign & Submit Intake →'}
            </button>
          </div>
        </Card>
      </form>

      <div className="flex justify-end mt-6">
        <Link to="/client/documents" className="text-xs font-semibold text-green-700 hover:text-green-800 underline">
          Go to Document Submission →
        </Link>
      </div>
    </PageContainer>
  );
}
