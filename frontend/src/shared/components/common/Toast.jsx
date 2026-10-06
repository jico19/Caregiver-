import { useEffect } from 'react';

export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 4000,
  className = '',
}) {
  useEffect(() => {
    if (!onClose || !duration) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  if (!message) return null;

  const alertClass =
    type === 'success'
      ? 'alert-soft alert-success'
      : type === 'warning'
      ? 'alert-soft alert-warning'
      : type === 'error'
      ? 'alert-soft alert-error'
      : 'alert-soft alert-neutral';

  return (
    <div className={`toast toast-end toast-bottom z-50 ${className}`.trim()}>
      <div className={`alert ${alertClass} text-xs shadow-md flex items-center justify-between gap-3 py-2.5 px-4 rounded-box border border-base-300`}>
        <span>{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss message"
            className="btn btn-ghost btn-xs text-slate-500 hover:text-slate-800 p-0 h-auto min-h-0"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
