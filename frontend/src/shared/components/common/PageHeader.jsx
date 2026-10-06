export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs,
  className = '',
}) {
  return (
    <div className={`mb-6 pb-4 border-b border-base-300 ${className}`.trim()}>
      {breadcrumbs && <div className="mb-2 text-xs text-slate-500">{breadcrumbs}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-600 mt-1 mb-0 leading-normal max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
