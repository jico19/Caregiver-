import React from 'react';

/**
 * Reusable Loading State Component
 * Provides clean spinners and skeleton placeholders for Supabase queries
 */
export default function LoadingState({
  title = 'Loading data...',
  subtitle = 'Retrieving records from healthcare database...',
  variant = 'page', // 'page' | 'cards' | 'table' | 'inline'
  count = 3,
}) {
  const spinnerSvg = (
    <svg
      className="spinner-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563eb"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ minWidth: '24px' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );

  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-2 text-secondary text-sm">
        {spinnerSvg}
        <span>{title}</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="flex flex-col gap-4" style={{ padding: '1rem 0' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '0.5rem' }}>
          {spinnerSvg}
          <div>
            <div className="font-semibold text-primary" style={{ fontSize: '0.95rem' }}>{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <div className="skeleton-box" style={{ width: '60%', height: '20px', marginBottom: '0.75rem' }} />
              <div className="skeleton-box" style={{ width: '90%', height: '14px', marginBottom: '0.5rem' }} />
              <div className="skeleton-box" style={{ width: '75%', height: '14px', marginBottom: '1.25rem' }} />
              <div className="flex justify-between items-center">
                <div className="skeleton-box" style={{ width: '30%', height: '24px', borderRadius: '12px' }} />
                <div className="skeleton-box" style={{ width: '25%', height: '28px', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div style={{ padding: '1rem 0' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
          {spinnerSvg}
          <div>
            <div className="font-semibold text-primary" style={{ fontSize: '0.95rem' }}>{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ height: '40px', backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }} />
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4"
              style={{
                padding: '1rem',
                borderBottom: i === count - 1 ? 'none' : '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
              }}
            >
              <div className="skeleton-box" style={{ width: '30%', height: '16px' }} />
              <div className="skeleton-box" style={{ width: '25%', height: '16px' }} />
              <div className="skeleton-box" style={{ width: '20%', height: '16px' }} />
              <div className="skeleton-box" style={{ width: '15%', height: '24px', marginLeft: 'auto', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: 'page' layout
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2.5rem 0' }}>
      <div className="loading-center-card">
        <div className="loading-spinner-circle">
          {spinnerSvg}
        </div>
        <h2 className="font-semibold text-primary" style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>
          {title}
        </h2>
        <p className="text-muted text-sm">
          {subtitle}
        </p>
      </div>

      {/* Placeholder skeleton cards below */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton-box" style={{ width: '50%', height: '18px', marginBottom: '0.75rem' }} />
            <div className="skeleton-box" style={{ width: '100%', height: '14px', marginBottom: '0.5rem' }} />
            <div className="skeleton-box" style={{ width: '80%', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
