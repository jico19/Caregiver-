import { useEffect } from 'react';

export default function ConfirmModal({
  isOpen = false,
  title = 'Confirm action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  isLoading = false,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && onCancel && !isLoading) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box bg-base-100 border border-base-300 max-w-md p-6 rounded-box">
        <h3 className="font-bold text-base text-slate-900 m-0">
          {title}
        </h3>
        <p className="text-xs text-slate-600 mt-2 mb-6 leading-normal">
          {description}
        </p>
        <div className="flex justify-end items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-ghost btn-sm text-slate-700"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`btn btn-sm ${
              isDestructive ? 'btn-error text-white' : 'btn-primary'
            }`}
          >
            {isLoading && <span className="loading loading-spinner loading-xs" />}
            {confirmText}
          </button>
        </div>
      </div>
      <div
        className="modal-backdrop bg-slate-900/40"
        onClick={isLoading ? undefined : onCancel}
      />
    </div>
  );
}
