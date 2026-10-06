import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import Card from '../../../shared/components/common/Card';

export default function TrainingCertificatePage() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const { data, isLoading: loading, error: errorMsg } = useFetch(
    `/training/courses/${courseId}/certificate`,
    {
      enabled: !!token && !!courseId,
      defaultData: { certificate: null },
    }
  );
  const cert = data?.certificate || null;

  if (loading) {
    return (
      <PageContainer size="narrow">
        <div className="py-12 text-center text-slate-500 text-sm">
          Preparing your completion certificate...
        </div>
      </PageContainer>
    );
  }

  if (errorMsg || !cert) {
    return (
      <PageContainer size="narrow" className="mt-8">
        <div role="alert" className="alert alert-error mb-4">
          <span>{errorMsg || 'Certificate not found.'}</span>
        </div>
        <Link to="/caregiver/training" className="btn btn-outline btn-sm w-full">
          Back to In-Service Training
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <div className="print-hidden flex justify-between items-center flex-wrap gap-2 mb-6">
        <Link to="/caregiver/training" className="text-slate-600 hover:text-slate-900 text-xs font-medium">
          ← Back to In-Service Training
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-primary btn-sm"
        >
          Print / Save as PDF
        </button>
      </div>

      <Card className="p-8 border-2 border-emerald-800/30 bg-base-100 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          Certificate of Completion
        </h1>
        <p className="text-slate-500 text-xs mb-8">
          CarePlatform In-Service Continuing Education
        </p>

        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
          This certifies that
        </p>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 font-serif">
          {cert.caregiver_name}
        </h2>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
          has successfully completed the in-service training course
        </p>
        <h3 className="text-base font-semibold text-slate-800 mb-8">
          {cert.course_name}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-base-300 text-left">
          <div>
            <div className="text-xs text-slate-400 mb-0.5">Certificate Number</div>
            <div className="text-xs font-mono font-semibold text-slate-800">{cert.certificate_number}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs text-slate-400 mb-0.5">Date Completed</div>
            <div className="text-xs font-semibold text-slate-800">
              {new Date(cert.completed_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-center text-xs text-slate-400 mt-4 print-hidden">
        This certificate is for record-keeping and compliance review. Save it as a PDF and upload a copy to your credential stack if requested.
      </p>
    </PageContainer>
  );
}
