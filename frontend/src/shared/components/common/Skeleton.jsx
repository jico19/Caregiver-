export default function Skeleton({
  variant = 'text',
  count = 1,
  className = '',
}) {
  const items = Array.from({ length: count });

  if (variant === 'circle') {
    return (
      <>
        {items.map((_, i) => (
          <div
            key={i}
            className={`skeleton bg-base-300 rounded-full w-10 h-10 shrink-0 ${className}`.trim()}
          />
        ))}
      </>
    );
  }

  if (variant === 'rect') {
    return (
      <>
        {items.map((_, i) => (
          <div
            key={i}
            className={`skeleton bg-base-300 rounded-box w-full h-24 ${className}`.trim()}
          />
        ))}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((_, i) => (
          <div
            key={i}
            className={`card bg-base-100 border border-base-300 p-5 flex flex-col gap-3 ${className}`.trim()}
          >
            <div className="skeleton bg-base-300 h-4 w-3/5 rounded" />
            <div className="skeleton bg-base-300 h-3 w-4/5 rounded" />
            <div className="skeleton bg-base-300 h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`flex flex-col gap-2.5 w-full ${className}`.trim()}>
        {items.map((_, i) => (
          <div
            key={i}
            className="skeleton bg-base-300 h-9 w-full rounded"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`.trim()}>
      {items.map((_, i) => (
        <div
          key={i}
          className={`skeleton bg-base-300 h-4 rounded ${i === items.length - 1 && items.length > 1 ? 'w-2/3' : 'w-full'} ${className}`.trim()}
        />
      ))}
    </div>
  );
}
