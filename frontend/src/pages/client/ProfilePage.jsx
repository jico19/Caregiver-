import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function ProfilePage() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [stateName, setStateName] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadClientProfile() {
      try {
        const res = await api.get('/clients/me', token);
        if (!isMounted) return;

        if (res?.profile) {
          const p = res.profile;
          setFirstName(p.first_name || '');
          setLastName(p.last_name || '');
          setPhone(p.phone || '');
          setAddress(p.address || '');
          setMedicaidNumber(p.medicaid_number || '');
          setStateName(p.states?.name || '');
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load client profile.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadClientProfile();
    return () => {
      isMounted = false;
    };
  }, [token]);

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

  if (loading) {
    return <div className="loading-text">Loading profile information...</div>;
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