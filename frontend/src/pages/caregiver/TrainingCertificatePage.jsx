import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export default function TrainingCertificatePage() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    api.get(`/training/courses/${courseId}/certificate`, token)
      .then((res) => {
        if (isMounted) setCert(res?.certificate || null);
      })
      .catch((err) => {
        if (isMounted) setErrorMsg(err.detail || 'Certificate is unavailable.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [courseId, token]);

  if (loading) {
    return <div className="loading-screen">Preparing your completion certificate...</div>;
  }

  if (errorMsg || !cert) {
    return (
      <div className="container-narrow mt-10">
        <div className="alert alert-error">
          {errorMsg || 'Certificate not found.'}
        </div>
        <Link to="/caregiver/training" className="btn-outline-secondary btn-full mt-4">
          Back to In-Service Training →
        </Link>
      </div>
    );
  }

  return (
    <div className="container-narrow">
      <div className="print-hidden flex justify-between items-center flex-wrap gap-2 mb-6">
        <Link to="/caregiver/training" className="text-secondary text-sm">
          ← Back to In-Service Training
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-primary"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="certificate-sheet">
        <h1 className="page-title text-center mb-1">
          Certificate of Completion
        </h1>
        <p className="text-center text-secondary text-sm mb-8">
          CarePlatform In-Service Continuing Education
        </p>

        <p className="certificate-body text-center mb-6">
          This certifies that
        </p>
        <h2 className="text-center text-xl font-bold mb-6">
          {cert.caregiver_name}
        </h2>
        <p className="certificate-body text-center mb-6">
          has successfully completed the in-service training course
        </p>
        <h3 className="text-center text-lg font-semibold mb-6">
          {cert.course_name}
        </h3>

        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mt-10 pt-6 border-t border-[var(--border-strong)]">
          <div>
            <div className="text-xs text-muted mb-1">Certificate Number</div>
            <div className="text-sm font-semibold">{cert.certificate_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Date Completed</div>
            <div className="text-sm font-semibold">
              {new Date(cert.completed_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted mt-4 print-hidden">
        This certificate is for record-keeping and compliance review. Save it as a PDF and upload a copy to your credential stack if requested.
      </p>
    </div>
  );
}