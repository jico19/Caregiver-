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
  const spinnerElement = (
    <span className="loading loading-spinner text-primary loading-md shrink-0" aria-hidden="true" />
  );

  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-2 text-secondary text-sm">
        {spinnerElement}
        <span>{title}</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          {spinnerElement}
          <div>
            <div className="font-semibold text-primary text-sm">{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="card bg-base-100 border border-base-200 shadow-sm p-5">
              <div className="skeleton w-3/5 h-5 mb-3" />
              <div className="skeleton w-11/12 h-3.5 mb-2" />
              <div className="skeleton w-3/4 h-3.5 mb-5" />
              <div className="flex justify-between items-center">
                <div className="skeleton w-1/3 h-6 rounded-full" />
                <div className="skeleton w-1/4 h-7 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="py-4">
        <div className="flex items-center gap-3 mb-4">
          {spinnerElement}
          <div>
            <div className="font-semibold text-primary text-sm">{title}</div>
            <div className="text-muted text-xs">{subtitle}</div>
          </div>
        </div>

        <div className="border border-base-200 rounded-md overflow-hidden bg-base-100">
          <div className="h-10 bg-base-200 border-b border-base-200" />
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b border-base-200 last:border-b-0"
            >
              <div className="skeleton w-1/3 h-4" />
              <div className="skeleton w-1/4 h-4" />
              <div className="skeleton w-1/5 h-4" />
              <div className="skeleton w-1/6 h-6 ml-auto rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: 'page' layout
  return (
    <div className="max-w-[960px] mx-auto py-10">
      <div className="flex flex-col items-center justify-center bg-base-100 border border-base-200 rounded-lg shadow-sm text-center mb-8 p-10">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          {spinnerElement}
        </div>
        <h2 className="font-semibold text-primary text-lg mb-1">
          {title}
        </h2>
        <p className="text-muted text-sm">
          {subtitle}
        </p>
      </div>

      {/* Placeholder skeleton cards below */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card bg-base-100 border border-base-200 shadow-sm p-6">
            <div className="skeleton w-1/2 h-4.5 mb-3" />
            <div className="skeleton w-full h-3.5 mb-2" />
            <div className="skeleton w-4/5 h-3.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
