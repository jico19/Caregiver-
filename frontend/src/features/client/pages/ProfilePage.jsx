import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import { api } from '../../../shared/services/api';

export default function ProfilePage() {
  const { token, user } = useAuth();
  const { data, isLoading: loading, error: fetchError } = useFetch('/clients/me', {
    enabled: !!token,
    defaultData: { profile: null },
  });

  if (loading) {
    return <div className="loading-text">Loading profile information...</div>;
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
  const [successMsg, setSuccessMsg] = useState('');

  const firstName = initialProfile?.first_name || '';
  const lastName = initialProfile?.last_name || '';
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [address, setAddress] = useState(initialProfile?.address || '');
  const [medicaidNumber, setMedicaidNumber] = useState(initialProfile?.medicaid_number || '');
  const stateName = initialProfile?.states?.name || '';

  async function handleSave(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);

    const payload = {
      phone: phone.trim() || null,
      address: address.trim() || null,
      medicaid_number: medicaidNumber.trim() || null,
    };

    try {
      await api.patch('/clients/me/profile', payload, token);
      setSuccessMsg('Your client profile has been updated successfully.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="container-narrow">
      <div className="page-head">
        <h1 className="page-title">
          Client Contact & Emergency Details
        </h1>
        <p className="page-subtitle">
          Registered State Office: <strong>{stateName || 'State Branch'}</strong> · Account: {user?.email}
        </p>
      </div>

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-error">
          {errorMsg || fetchError}
        </div>
      )}


      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="form-card">
        <div className="form-grid-2">
          <div>
            <label>
              First Name
            </label>
            <input
              type="text"
              disabled
              value={firstName}
            />
          </div>

          <div>
            <label>
              Last Name
            </label>
            <input
              type="text"
              disabled
              value={lastName}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="client-phone">
              Primary Phone Number
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
              Medicaid ID / Member Number
            </label>
            <input
              id="client-medicaid"
              type="text"
              value={medicaidNumber}
              onChange={(e) => setMedicaidNumber(e.target.value)}
              placeholder="State Medicaid Number"
            />
          </div>
        </div>

        <div>
          <label htmlFor="client-address">
            Home Service Address
          </label>
          <input
            id="client-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, City, State, ZIP"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-success-full"
        >
          {saving ? 'Updating...' : 'Save Contact Details'}
        </button>
      </form>
    </div>
  );
}
