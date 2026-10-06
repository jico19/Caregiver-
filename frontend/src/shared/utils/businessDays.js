export function businessDaysAgo(isoString) {
  if (!isoString) return null;

  const from = new Date(isoString);
  if (Number.isNaN(from.getTime())) return null;

  const now = new Date();
  let total = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  while (cursor < today) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function formatBusinessDaysAgo(isoString) {
  const days = businessDaysAgo(isoString);
  if (days === null) return '';

  if (days === 0) return 'Submitted today';
  if (days === 1) return 'Submitted 1 business day ago';
  return `Submitted ${days} business days ago`;
}