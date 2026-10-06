export default function ApplicationSuccessScreen({ successMode, onNavigateDashboard, onNavigateDocuments }) {
  const isResubmit = successMode === 'resubmit';

  return (
    <div className="container-narrow">
      <div className="card text-center stat-card-success p-6">
        <div className="success-icon-circle">
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="page-title mb-2">
          {isResubmit ? 'Application Resubmitted Successfully!' : 'Application Submitted Successfully!'}
        </h1>
        <p className="text-secondary text-sm leading-normal max-w-lg mx-auto mb-6">
          {isResubmit
            ? 'Your updated application details have been received and are now back under review by our state compliance team.'
            : 'Welcome to the CarePlatform clinical team! Your onboarding profile has been created and your application is now under review by our state compliance team.'}
        </p>

        <div className="card-muted mb-6 text-left">
          <h3 className="font-semibold text-sm mb-2">
            Next Steps in Your Onboarding:
          </h3>
          <ul className="bullet-list">
            <li><strong>Upload Credentials:</strong> Provide your CPR certificate, Driver's License, and CNA/HHA license in the portal.</li>
            <li><strong>Administrative Review:</strong> A clinical supervisor will verify your information within 1–2 business days.</li>
            <li><strong>In-Service Training:</strong> Access online orientation and safety modules once approved.</li>
          </ul>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="btn-primary btn-lg"
          >
            Go to Caregiver Dashboard →
          </button>
          <button
            type="button"
            onClick={onNavigateDocuments}
            className="btn-outline-secondary btn-lg"
          >
            Upload Credentials →
          </button>
        </div>
      </div>
    </div>
  );
}
