import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';

export default function ProfilePage() {
  const { token, user } = useAuth();
  const { data, isLoading: loading, error: fetchError } = useFetch('/caregivers/me', {
    enabled: !!token,
    defaultData: { profile: null },
  });

  if (loading) {
    return (
      <PageContainer size="narrow">
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading profile information...
        </div>
      </PageContainer>
    );
  }

  return (
    <CaregiverProfileForm
      initialProfile={data?.profile}
      token={token}
      user={user}
      fetchError={fetchError}
    />
  );
}

function CaregiverProfileForm({ initialProfile, token, user, fetchError }) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [firstName, setFirstName] = useState(initialProfile?.first_name || '');
  const [lastName, setLastName] = useState(initialProfile?.last_name || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [address, setAddress] = useState(initialProfile?.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile?.date_of_birth || '');
  const [ssnLast4, setSsnLast4] = useState(initialProfile?.ssn_last4 || '');
  const [stateId, setStateId] = useState(initialProfile?.state_id ? String(initialProfile.state_id) : (user?.state_id ? String(user.state_id) : '1'));

  async function handleSave(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (ssnLast4 && ssnLast4.length !== 4) {
      setErrorMsg('SSN Last 4 must be exactly 4 digits.');
      return;
    }

    setSaving(true);

    const payload = {
      state_id: parseInt(stateId, 10),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      date_of_birth: dateOfBirth || null,
      ssn_last4: ssnLast4.trim() || null,
    };

    try {
      await api.patch('/caregivers/me/profile', payload, token);
      setSuccessMsg('Your profile has been updated successfully.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update profile. Please verify your information.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Caregiver Profile & Settings"
        subtitle="Keep your contact information, residential address, and licensing jurisdiction accurate for state compliance."
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{errorMsg || fetchError}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{successMsg}</span>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" id="first-name" required>
              <input
                id="first-name"
                type="text"
                required
                className="input input-bordered w-full text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </FormField>

            <FormField label="Last Name" id="last-name" required>
              <input
                id="last-name"
                type="text"
                required
                className="input input-bordered w-full text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Licensing State Branch" id="state" required>
              <select
                id="state"
                className="select select-bordered w-full text-sm"
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
              >
                <option value="1">Florida (FL)</option>
                <option value="2">Indiana (IN)</option>
                <option value="3">Georgia (GA)</option>
              </select>
            </FormField>

            <FormField label="Contact Telephone" id="phone">
              <input
                id="phone"
                type="tel"
                className="input input-bordered w-full text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </FormField>
          </div>

          <FormField label="Residential Address" id="address">
            <input
              id="address"
              type="text"
              className="input input-bordered w-full text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, City, State, ZIP"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date of Birth" id="dob">
              <input
                id="dob"
                type="date"
                className="input input-bordered w-full text-sm"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </FormField>

            <FormField label="SSN (Last 4 Digits)" id="ssn-last4">
              <input
                id="ssn-last4"
                type="password"
                maxLength={4}
                className="input input-bordered w-full text-sm"
                value={ssnLast4}
                onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
              />
            </FormField>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
