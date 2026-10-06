import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../shared/services/api';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import Toast from '../../../shared/components/common/Toast';

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
  const [toastMsg, setToastMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');
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
      setToastMsg(res.message || 'Thank you! Your inquiry has been received.');
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
    <PageContainer>
      <PageHeader
        breadcrumbs={
          <Link to={`/${state}`} className="text-slate-600 hover:text-slate-900 hover:underline">
            ← Back to {stateName} Office
          </Link>
        }
        title={`Contact Our ${stateName} Regional Office`}
        subtitle="Request care consultations, submit physician referrals, or inquire about Medicaid waiver eligibility."
      />

      {errorMsg && (
        <div role="alert" className="alert alert-soft alert-error my-4">
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start my-6">
        {/* Form Card */}
        <Card title="Request Care Consultation / Referral">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="First Name" htmlFor="inquiry-first" required>
                <input
                  id="inquiry-first"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="Jane"
                />
              </FormField>

              <FormField label="Last Name" htmlFor="inquiry-last" required>
                <input
                  id="inquiry-last"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="Doe"
                />
              </FormField>
            </div>

            <FormField label="Telephone" htmlFor="inquiry-phone" required>
              <input
                id="inquiry-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="input input-bordered w-full"
              />
            </FormField>

            <FormField label="Email Address" htmlFor="inquiry-email">
              <input
                id="inquiry-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="input input-bordered w-full"
              />
            </FormField>

            <FormField label="I am reaching out as a" htmlFor="inquiry-source">
              <select
                id="inquiry-source"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="Family Member">Family Member Seeking Care</option>
                <option value="Self / Patient">Care Recipient (Self)</option>
                <option value="Physician / Hospital">Physician / Hospital Discharge Planner</option>
                <option value="Medicaid Case Manager">Medicaid Case Manager / Waiver Coordinator</option>
                <option value="Other">Other Community Partner</option>
              </select>
            </FormField>

            <FormField label="Care Needs or Specific Inquiries" htmlFor="inquiry-notes">
              <textarea
                id="inquiry-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us about required hours, mobility needs, or Medicaid program status..."
                className="textarea textarea-bordered w-full"
              />
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm mt-2 w-full sm:w-auto self-start"
            >
              {submitting ? 'Submitting...' : `Send Inquiry to ${stateName} Team`}
            </button>
          </form>
        </Card>

        {/* Office Details */}
        <div className="flex flex-col gap-6">
          <Card title={`${stateName} Regional Coordination Center`}>
            <div className="text-xs text-slate-600 leading-relaxed flex flex-col gap-2 mt-1">
              <div><strong className="text-slate-800">Operating Hours:</strong> Mon - Fri: 8:00 AM - 5:00 PM EST</div>
              <div><strong className="text-slate-800">Clinical On-Call:</strong> 24/7 Registered Nurse Emergency Line</div>
              <div><strong className="text-slate-800">Response Time:</strong> Clinical triage within 2 business hours</div>
            </div>
          </Card>

          <Card
            title="Already registered?"
            subtitle="Existing caregivers and client families can access direct messaging and real-time records inside the portals."
          >
            <div className="flex gap-3 flex-wrap mt-2">
              <Link
                to="/caregiver/login"
                className="btn btn-outline btn-sm text-slate-700"
              >
                Caregiver Portal →
              </Link>
              <Link
                to="/client/login"
                className="btn btn-outline btn-sm text-slate-700"
              >
                Client Portal →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}