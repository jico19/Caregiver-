export default function FieldError({ message }) {
  if (!message) return null;
  return <span className="text-xs text-red-600 mt-1 block">{message}</span>;
}
