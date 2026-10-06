const STATUS_VARIANT_MAP = {
  active: 'success',
  approved: 'success',
  completed: 'success',
  pass: 'success',
  valid: 'success',
  signed: 'success',
  hired: 'success',

  pending: 'warning',
  draft: 'warning',
  submitted: 'warning',
  in_review: 'warning',
  under_review: 'warning',
  expiring_soon: 'warning',
  warning: 'warning',

  rejected: 'error',
  expired: 'error',
  suspended: 'error',
  terminated: 'error',
  discharged: 'error',
  failed: 'error',

  info: 'neutral',
  not_started: 'neutral',
  archived: 'neutral',
};

export default function StatusBadge({
  status,
  variant,
  label,
  size = 'sm',
  className = '',
}) {
  const normalizedStatus = typeof status === 'string' ? status.toLowerCase().replace(/\s+/g, '_') : '';
  const resolvedVariant = variant || STATUS_VARIANT_MAP[normalizedStatus] || 'neutral';

  const variantClass =
    resolvedVariant === 'success'
      ? 'badge-soft badge-success'
      : resolvedVariant === 'warning'
      ? 'badge-soft badge-warning'
      : resolvedVariant === 'error'
      ? 'badge-soft badge-error'
      : 'badge-soft badge-neutral';

  const sizeClass = size === 'xs' ? 'badge-xs' : size === 'md' ? 'badge-md' : 'badge-sm';
  const displayLabel = label ?? status ?? 'Unknown';

  return (
    <span
      className={`badge ${variantClass} ${sizeClass} font-medium capitalize shrink-0 ${className}`.trim()}
    >
      {displayLabel}
    </span>
  );
}
