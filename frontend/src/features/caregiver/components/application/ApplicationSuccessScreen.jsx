import PageContainer from '../../../../shared/components/common/PageContainer';
import Card from '../../../../shared/components/common/Card';

export default function ApplicationSuccessScreen({ successMode, onNavigateDashboard, onNavigateDocuments }) {
  const isResubmit = successMode === 'resubmit';

  return (
    <PageContainer size="narrow">
      <Card className="text-center p-8 border-emerald-200 bg-emerald-50/20">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {isResubmit ? 'Application Resubmitted Successfully!' : 'Application Submitted Successfully!'}
        </h1>
        <p className="text-slate-600 text-sm leading-normal max-w-lg mx-auto mb-6">
          {isResubmit
            ? 'Your updated application details have been received and are now back under review by our state compliance team.'
            : 'Welcome to the CarePlatform clinical team! Your onboarding profile has been created and your application is now under review by our state compliance team.'}
        </p>

        <div className="p-4 rounded border border-base-300 bg-base-100 mb-6 text-left">
          <h3 className="font-semibold text-sm text-slate-900 mb-2">
            Next Steps in Your Onboarding:
          </h3>
          <ul className="text-xs text-slate-600 space-y-2 pl-4 list-disc">
            <li><strong>Upload Credentials:</strong> Provide your CPR certificate, Driver's License, and CNA/HHA license in the portal.</li>
            <li><strong>Administrative Review:</strong> A clinical supervisor will verify your information within 1–2 business days.</li>
            <li><strong>In-Service Training:</strong> Access online orientation and safety modules once approved.</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="btn btn-primary"
          >
            Go to Caregiver Dashboard
          </button>
          <button
            type="button"
            onClick={onNavigateDocuments}
            className="btn btn-outline"
          >
            Upload Credentials
          </button>
        </div>
      </Card>
    </PageContainer>
  );
}
