export const STATE_SLUG_MAP = {
  florida: '1',
  indiana: '2',
  georgia: '3',
};

const STATE_LABELS = {
  1: 'Florida (FL)',
  2: 'Indiana (IN)',
  3: 'Georgia (GA)',
};

export function getStateName(id) {
  return STATE_LABELS[id] || `State #${id}`;
}
