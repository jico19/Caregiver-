import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import Toast from '../../../shared/components/common/Toast';
import LoadingState from '../../../shared/components/common/LoadingState';

export default function ProfilePage() {
  const { token, user } = useAuth();
  const { data, isLoading: loading, error: fetchError } = useFetch('/clients/me', {
    enabled: !!token,
    defaultData: { profile: null },
  });

  if (loading) {
    return (
      <LoadingState
        title="Loading Profile..."
        subtitle="Retrieving contact information..."
        variant="page"
      />
    );
  }

  return (
    <ClientProfileForm
      initialProfile={data?.profile}
      token={token}
      user={user}
      fetchError={fetchError}
    />
  );
}

function ClientProfileForm({ initialProfile, token, user, fetchError }) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const firstName = initialProfile?.first_name || '';
  const lastName = initialProfile?.last_name || '';
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [address, setAddress] = useState(initialProfile?.address || '');
  const [medicaidNumber, setMedicaidNumber] = useState(initialProfile?.medicaid_number || '');
  const stateName = initialProfile?.states?.name || '';

  async function handleSave(e) {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');
    setSaving(true);

    const payload = {
      phone: phone.trim() || null,
      address: address.trim() || null,
      medicaid_number: medicaidNumber.trim() || null,
    };

    try {
      await api.patch('/clients/me/profile', payload, token);
      setToastMsg('Your client profile has been updated successfully.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Client Contact & Emergency Details"
        subtitle={`Registered State Office: ${stateName || 'State Branch'} · Account: ${user?.email}`}
      />

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg || fetchError}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      <Card title="Personal & Contact Details">
        <form onSubmit={handleSave} className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" htmlFor="profile-first">
              <input
                id="profile-first"
                type="text"
                disabled
                value={firstName}
                className="input input-bordered w-full bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </FormField>

            <FormField label="Last Name" htmlFor="profile-last">
              <input
                id="profile-last"
                type="text"
                disabled
                value={lastName}
                className="input input-bordered w-full bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Primary Phone Number" htmlFor="client-phone">
              <input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="input input-bordered w-full"
              />
            </FormField>

            <FormField label="Medicaid ID / Member Number" htmlFor="client-medicaid">
              <input
                id="client-medicaid"
                type="text"
                value={medicaidNumber}
                onChange={(e) => setMedicaidNumber(e.target.value)}
                placeholder="State Medicaid Number"
                className="input input-bordered w-full"
              />
            </FormField>
          </div>

          <FormField label="Home Service Address" htmlFor="client-address">
            <input
              id="client-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, City, State, ZIP"
              className="input input-bordered w-full"
            />
          </FormField>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary btn-sm self-start mt-2"
          >
            {saving ? 'Updating...' : 'Save Contact Details'}
          </button>
        </form>
      </Card>
    </PageContainer>
  );
}
