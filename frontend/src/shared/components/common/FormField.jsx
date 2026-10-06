export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className = '',
}) {
  return (
    <div className={`w-full flex flex-col ${className}`.trim()}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold text-slate-800 mb-1"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-500 mt-1 mb-0 leading-normal">
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-error font-medium mt-1 mb-0 leading-normal">
          {error}
        </p>
      )}
    </div>
  );
}
