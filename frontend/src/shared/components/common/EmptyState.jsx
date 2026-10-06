export default function EmptyState({
  title = 'No records found',
  description = null,
  icon = null,
  action = null,
  className = '',
}) {
  return (
    <div
      className={`card bg-base-100 border border-dashed border-base-300 p-8 sm:p-10 text-center flex flex-col items-center justify-center ${className}`.trim()}
    >
      {icon && <div className="text-slate-400 mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-800 m-0">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-0 leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
