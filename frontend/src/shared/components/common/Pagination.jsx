import React from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getPageWindow(current, last) {
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  const window = new Set([1, last]);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p > 1 && p < last) window.add(p);
  }
  const sorted = [...window].sort((a, b) => a - b);
  const withEllipsis = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) withEllipsis.push('...');
    withEllipsis.push(p);
    prev = p;
  }
  return withEllipsis;
}

export default function Pagination({
  page,
  pages,
  total,
  pageSize,
  listLabel = 'results',
  onPageChange,
  onPageSizeChange,
  showPageSize = true,
}) {
  if (!pages || pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const window = getPageWindow(page, pages);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-base-200" aria-label="Pagination">
      <div className="text-sm text-secondary">
        Showing <strong>{first}–{last}</strong> of <strong>{total}</strong> {listLabel}
      </div>

      <div className="join">
        <button
          type="button"
          className="join-item btn btn-sm btn-outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {window.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="join-item btn btn-sm btn-disabled" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`join-item btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="join-item btn btn-sm btn-outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>

      {showPageSize && onPageSizeChange && (
        <label className="flex items-center gap-2 text-sm text-secondary m-0">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="select select-bordered select-xs w-auto"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}