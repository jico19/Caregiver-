import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';

export default function ContactPage() {
  const { state = 'florida' } = useParams();
  const stateName = state.charAt(0).toUpperCase() + state.slice(1);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [referralSource, setReferralSource] = useState('Family Member');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      referral_source: referralSource,
      notes: notes.trim() || null,
    };

    try {
      const res = await api.post(`/states/${state}/contact`, payload);
      setSuccessMsg(res.message || 'Thank you! Your inquiry has been submitted.');
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setNotes('');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to submit inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-880">
      <div className="page-head">
        <Link to={`/${state}`} className="text-secondary text-sm">
          ← Back to {stateName} Office
        </Link>
        <h1 className="page-title mt-2 mb-1">
          Contact Our {stateName} Regional Office
        </h1>
        <p className="page-subtitle">
          Request care consultations, submit physician referrals, or inquire about Medicaid waiver eligibility.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          <strong>Inquiry Received!</strong> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 items-start">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          <h2 className="section-title-bordered">
            Request Care Consultation / Referral
          </h2>

          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
            <div>
              <label htmlFor="inquiry-first">
                First Name *
              </label>
              <input
                id="inquiry-first"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="inquiry-last">
                Last Name *
              </label>
              <input
                id="inquiry-last"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="inquiry-phone">
              Telephone *
            </label>
            <input
              id="inquiry-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>

          <div>
            <label htmlFor="inquiry-email">
              Email Address
            </label>
            <input
              id="inquiry-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label htmlFor="inquiry-source">
              I am reaching out as a:
            </label>
            <select
              id="inquiry-source"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
            >
              <option value="Family Member">Family Member Seeking Care</option>
              <option value="Self / Patient">Care Recipient (Self)</option>
              <option value="Physician / Hospital">Physician / Hospital Discharge Planner</option>
              <option value="Medicaid Case Manager">Medicaid Case Manager / Waiver Coordinator</option>
              <option value="Other">Other Community Partner</option>
            </select>
          </div>

          <div>
            <label htmlFor="inquiry-notes">
              Care Needs or Specific Inquiries
            </label>
            <textarea
              id="inquiry-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell us about required hours, mobility needs, or Medicaid program status..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-2"
          >
            {submitting ? 'Submitting...' : `Send Inquiry to ${stateName} Team`}
          </button>
        </form>

        {/* Office Details */}
        <div className="flex flex-col gap-4 items-start">
          <div className="card w-full">
            <h3 className="card-title mb-3">
              {stateName} Regional Coordination Center
            </h3>
            <div className="text-secondary text-sm leading-normal">
              <p><strong>Operating Hours:</strong> Mon - Fri: 8:00 AM - 5:00 PM EST</p>
              <p><strong>Clinical On-Call:</strong> 24/7 Registered Nurse Emergency Line</p>
              <p><strong>Response Time:</strong> Clinical triage within 2 business hours</p>
            </div>
          </div>

          <div className="card-muted w-full">
            <h3 className="card-title mb-2">
              Already registered?
            </h3>
            <p className="text-secondary text-sm mb-4 leading-normal">
              Existing caregivers and client families can access direct messaging and real-time records inside the portals.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                to="/caregiver/login"
                className="btn-outline-primary"
              >
                Caregiver Portal
              </Link>
              <Link
                to="/client/login"
                className="btn-outline-success"
              >
                Client Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}