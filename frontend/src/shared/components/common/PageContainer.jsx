export default function PageContainer({
  children,
  size = 'default',
  className = '',
}) {
  const maxW =
    size === 'narrow'
      ? 'max-w-4xl'
      : size === 'wide'
      ? 'max-w-7xl'
      : 'max-w-6xl';

  return (
    <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 ${maxW} ${className}`.trim()}>
      {children}
    </div>
  );
}
