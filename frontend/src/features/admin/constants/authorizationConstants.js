export const STATE_CODE_MAP = {
  1: 'FL',
  2: 'IN',
  3: 'GA',
};

export const STATUS_BADGE_CLASS = {
  active: 'badge badge-success',
  expiring_soon: 'badge badge-warning',
  expired: 'badge badge-error',
  pending: 'badge badge-info',
  rejected: 'badge badge-ghost',
};

export const STATUS_DAYS_CLASS = {
  active: 'days-text days-active',
  expiring_soon: 'days-text days-soon',
  expired: 'days-text days-expired',
};

export const COMMON_NOTE_PRESETS = [
  'Personal Care Assistance (PCA) — 20 hrs/wk',
  'Home Health Aide (HHA) — Skilled Care',
  'Companion & Homemaker Services — 15 hrs/wk',
  'Respite Care Services — Level 2 support',
];

export function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function computeFutureDateStr(baseDateStr, daysToAdd) {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + daysToAdd);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function generateAuthNumber(stateCode = 'FL') {
  const code = (stateCode || 'FL').toUpperCase();
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `AUTH-${code}-${year}-${randomSuffix}`;
}

export function getAuthStatusDetails(startDateStr, endDateStr, rawStatus) {
  if (rawStatus === 'pending') {
    return {
      statusKey: 'pending',
      label: 'Pending Review',
      daysText: 'Awaiting review',
    };
  }

  if (rawStatus === 'rejected') {
    return {
      statusKey: 'rejected',
      label: 'Rejected',
      daysText: 'Not approved',
    };
  }

  if (!endDateStr) {
    return {
      statusKey: rawStatus || 'active',
      label: (rawStatus || 'ACTIVE').toUpperCase(),
      daysText: 'Active',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      statusKey: 'expired',
      label: 'Expired',
      daysText: `Expired ${Math.abs(diffDays)}d ago`,
    };
  }

  if (diffDays <= 30) {
    return {
      statusKey: 'expiring_soon',
      label: 'Expiring Soon',
      daysText: `${diffDays}d left`,
    };
  }

  return {
    statusKey: 'active',
    label: 'Active',
    daysText: `${diffDays}d left`,
  };
}

export function calculateAuthMetrics(authorizations) {
  let total = authorizations.length;
  let active = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const a of authorizations) {
    const info = getAuthStatusDetails(a.start_date, a.end_date, a.status);
    if (info.statusKey === 'expired') {
      expired++;
    } else if (info.statusKey === 'expiring_soon') {
      expiringSoon++;
    } else {
      active++;
    }
  }

  return { total, active, expiringSoon, expired };
}

export function filterAndSortAuthorizations(authorizations, searchTerm, filterState, filterStatus, sortBy) {
  return authorizations
    .filter((a) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const authMatch = a.authorization_number?.toLowerCase().includes(q);
        const clientName = `${a.clients?.first_name || ''} ${a.clients?.last_name || ''}`.toLowerCase();
        const clientMatch = clientName.includes(q);
        const medMatch = a.clients?.medicaid_number?.toLowerCase().includes(q);
        const notesMatch = a.notes?.toLowerCase().includes(q);
        if (!authMatch && !clientMatch && !medMatch && !notesMatch) return false;
      }

      if (filterState !== 'all') {
        const code = (a.states?.code || '').toLowerCase();
        if (code !== filterState.toLowerCase()) return false;
      }

      if (filterStatus !== 'all') {
        const info = getAuthStatusDetails(a.start_date, a.end_date, a.status);
        if (info.statusKey !== filterStatus) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'end_date_asc') return new Date(a.end_date) - new Date(b.end_date);
      if (sortBy === 'end_date_desc') return new Date(b.end_date) - new Date(a.end_date);
      if (sortBy === 'created_desc') return new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date);
      if (sortBy === 'client_name') {
        const nameA = `${a.clients?.last_name || ''} ${a.clients?.first_name || ''}`;
        const nameB = `${b.clients?.last_name || ''} ${b.clients?.first_name || ''}`;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
}

