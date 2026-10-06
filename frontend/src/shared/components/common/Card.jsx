export default function Card({
  children,
  title,
  subtitle,
  actions,
  compact = false,
  className = '',
}) {
  const paddingClass = compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6';
  const hasHeader = title || subtitle || actions;

  return (
    <div className={`card bg-base-100 border border-base-300 rounded-box ${paddingClass} ${className}`.trim()}>
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-base-300">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 m-0">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 m-0 leading-normal">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
