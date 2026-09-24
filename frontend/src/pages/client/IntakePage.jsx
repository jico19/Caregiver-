import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

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
    setSubmitting(true);

    const payload = {
      state_id: parseInt(stateId, 10),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      medicaid_number: medicaidNumber.trim() || null,
    };

    try {
      await api.post('/clients/intake', payload, token);
      setSuccessMsg('Your intake information has been recorded successfully. An intake coordinator will reach out to assess your care requirements.');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit client intake. Please verify your information.');
    } finally {
      setSubmitting(false);
    }
  }

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

        <button
          type="submit"
          disabled={submitting}
          className="btn-success-full"
        >
          {submitting ? 'Saving Intake...' : 'Save & Submit Intake'}
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