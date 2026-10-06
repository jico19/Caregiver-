export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  emptyMessage = 'No records found.',
  isLoading = false,
  onRowClick = null,
  className = '',
}) {
  return (
    <div className={`overflow-x-auto border border-base-300 rounded-box bg-base-100 ${className}`.trim()}>
      <table className="table table-sm w-full">
        <thead>
          <tr className="bg-base-200 text-slate-700 text-xs font-semibold border-b border-base-300">
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`py-3 px-3.5 text-left font-semibold ${col.headerClassName || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: 4 }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`} className="border-b border-base-300 last:border-0">
                {columns.map((col, cIdx) => (
                  <td key={`skeleton-cell-${cIdx}`} className="py-3 px-3.5">
                    <div className="skeleton h-4 w-3/4 bg-base-300 rounded" />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading && data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-xs text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {!isLoading &&
            data.map((row, rIdx) => {
              const rowKey = row[keyField] ?? rIdx;
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={rowKey}
                  onClick={isClickable ? () => onRowClick(row) : undefined}
                  className={`border-b border-base-300 last:border-0 transition-colors ${
                    isClickable ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={col.key || cIdx}
                      className={`py-2.5 px-3.5 text-xs text-slate-700 ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row, rIdx) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
