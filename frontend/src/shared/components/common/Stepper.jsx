export default function Stepper({
  steps = [],
  activeStep = 0,
  onStepClick = null,
  className = '',
}) {
  return (
    <ul className={`steps steps-vertical md:steps-horizontal w-full ${className}`.trim()}>
      {steps.map((step, idx) => {
        const isComplete = step.completed ?? idx < activeStep;
        const isCurrent = step.current ?? idx === activeStep;
        const isPrimary = isComplete || isCurrent;
        const isClickable = Boolean(onStepClick);

        return (
          <li
            key={step.key || idx}
            data-content={isComplete ? '✓' : `${idx + 1}`}
            className={`step text-xs ${isPrimary ? 'step-primary font-semibold' : 'text-slate-500'} ${
              isClickable ? 'cursor-pointer' : ''
            }`}
            onClick={isClickable ? () => onStepClick(step, idx) : undefined}
          >
            <span className="mt-1">{step.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
