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
    <nav className="pager" aria-label="Pagination">
      <div className="pager-range">
        Showing <strong>{first}–{last}</strong> of <strong>{total}</strong> {listLabel}
      </div>

      <div className="pager-controls">
        <button
          type="button"
          className="pager-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {window.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pager-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pager-btn${p === page ? ' pager-btn-active' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="pager-btn"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>

      {showPageSize && onPageSizeChange && (
        <label className="pager-size">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="select-compact"
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