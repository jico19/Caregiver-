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
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ssnLast4, setSsnLast4] = useState('');
  const [stateId, setStateId] = useState(user?.state_id ? String(user.state_id) : '1');

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const res = await api.get('/caregivers/me', token);
        if (!isMounted) return;

        if (res?.profile) {
          const p = res.profile;
          setFirstName(p.first_name || '');
          setLastName(p.last_name || '');
          setPhone(p.phone || '');
          setAddress(p.address || '');
          setDateOfBirth(p.date_of_birth || '');
          setSsnLast4(p.ssn_last4 || '');
          if (p.state_id) setStateId(String(p.state_id));
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load caregiver profile.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadProfile();
    return () => {
      isMounted = false;
    };
  }, [token]);

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

  if (loading) {
    return <div className="loading-screen">Loading profile information...</div>;
  }

  return (
    <div className="container-narrow">
      <div className="mb-6">
        <h1 className="page-title">
          Caregiver Profile & Settings
        </h1>
        <p className="page-subtitle">
          Keep your contact information, residential address, and licensing jurisdiction accurate for state compliance.
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

      <form onSubmit={handleSave} className="card flex flex-col gap-4">
        <div className="form-grid-2">
          <div>
            <label htmlFor="first-name">
              First Name *
            </label>
            <input
              id="first-name"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="last-name">
              Last Name *
            </label>
            <input
              id="last-name"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="state">
              Licensing State Branch *
            </label>
            <select
              id="state"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
            >
              <option value="1">Florida (FL)</option>
              <option value="2">Indiana (IN)</option>
              <option value="3">Georgia (GA)</option>
            </select>
          </div>

          <div>
            <label htmlFor="phone">
              Contact Telephone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>
        </div>

        <div>
          <label htmlFor="address">
            Residential Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, City, State, ZIP"
          />
        </div>

        <div className="form-grid-2">
          <div>
            <label htmlFor="dob">
              Date of Birth
            </label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="ssn-last4">
              SSN (Last 4 Digits)
            </label>
            <input
              id="ssn-last4"
              type="password"
              maxLength={4}
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary mt-2"
        >
          {saving ? 'Saving Changes...' : 'Save Profile Details'}
        </button>
      </form>
    </div>
  );
}
