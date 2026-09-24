import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function CarePlanPage() {
  const { token } = useAuth();
  const [carePlan, setCarePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadCarePlan() {
      try {
        const res = await api.get('/clients/me/care-plan', token);
        if (!isMounted) return;
        setCarePlan(res?.care_plan || null);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load plan of care details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadCarePlan();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return <div className="loading-text">Loading plan of care...</div>;
  }

  return (
    <div className="container-880">
      <div className="page-head">
        <h1 className="page-title">
          Personalized Plan of Care (POC)
        </h1>
        <p className="page-subtitle">
          Clinical supervisor directives, daily assistance routines, and safety instructions.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {/* Plan Header */}
      <div className="card mb-6">
        <div className="grid grid-cols-4 max-md:grid-cols-1 gap-4">
          <div>
            <div className="meta-block">Care Recipient</div>
            <div className="meta-value-strong">
              {carePlan?.client_name || 'Client'}
            </div>
          </div>
          <div>
            <div className="meta-block">Clinical Supervisor</div>
            <div className="meta-value">
              {carePlan?.primary_nurse}
            </div>
          </div>
          <div>
            <div className="meta-block">Plan Status</div>
            <div className="meta-value-status">
              {carePlan?.plan_status?.replace('_', ' ')}
            </div>
          </div>
          <div>
            <div className="meta-block">Effective Date</div>
            <div className="meta-value">
              {carePlan?.effective_date}
            </div>
          </div>
        </div>
      </div>

      {/* Activities Table */}
      <div className="card mb-6">
        <h2 className="section-title">
          Authorized Daily Living Activities (ADLs)
        </h2>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Frequency</th>
                <th>Caregiver Directive</th>
              </tr>
            </thead>
            <tbody>
              {carePlan?.daily_activities?.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-medium">
                    {item.task}
                  </td>
                  <td className="text-primary font-medium">
                    {item.frequency}
                  </td>
                  <td className="text-secondary">
                    {item.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Card */}
      <div className="emergency-callout">
        <h3 className="emergency-callout-title">
          Emergency Protocol
        </h3>
        <p className="emergency-callout-text">
          {carePlan?.emergency_protocol}
        </p>
      </div>
    </div>
  );
}