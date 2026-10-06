// Single source of truth for role checks and portal routing.
//
// `super_admin` is an administrative role: it has all-state access, whereas
// `administrator` is limited to users.state_id. See
// backend/app/core/dependencies.py and
// supabase/migrations/20260924101900_super_admin_state_scoping.sql.
//
// Always compare roles through these helpers. A bare
// `role === 'administrator'` does not match a super_admin and silently drops
// them into the client or caregiver portal, because those checks are written
// as a fallthrough chain whose final `else` is the caregiver/client route.

export const ADMIN_ROLES = ['administrator', 'super_admin'];

export function isAdmin(user) {
  return Boolean(user) && ADMIN_ROLES.includes(user.role);
}

export function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

// Where a freshly authenticated user belongs, regardless of which login page
// they used. Both login pages previously duplicated this chain.
export function homePathFor(user) {
  if (isAdmin(user)) return '/admin/dashboard';
  if (user?.role === 'client') return '/client/dashboard';
  return '/caregiver/dashboard';
}

// State scope as the portal chrome displays it.
//
// The `user.states` relation is the source of truth; the numeric and string
// fallbacks cover the token shapes the API still returns. This is the one
// place a state's code is spelled out, so a new state is added to these maps
// rather than branched on in a component.
//
// Never fall back to a specific state for a user who has none: showing "FL"
// to a user scoped to another state misreports their access. A super_admin
// has state_id NULL, which is "All States" rather than any single code.
const STATE_CODES_BY_ID = { 1: 'FL', 2: 'IN', 3: 'GA' };
const STATE_CODES_BY_ABBR = { fl: 'FL', in: 'IN', ga: 'GA' };
const STATE_CODES_BY_NAME = { florida: 'FL', indiana: 'IN', georgia: 'GA' };

export function stateLabelFor(user) {
  if (!user) return 'Unassigned';

  const relationCode = user.states?.code || user.state_code;
  if (relationCode) return String(relationCode).trim().toUpperCase();

  const codeById = STATE_CODES_BY_ID[user.state_id];
  if (codeById) return codeById;

  if (typeof user.state === 'string') {
    const raw = user.state.trim();
    const key = raw.toLowerCase();
    const matched =
      STATE_CODES_BY_ABBR[key] ||
      Object.keys(STATE_CODES_BY_NAME).find((name) => key.includes(name));
    if (matched) return matched;
    if (raw) return raw.toUpperCase();
  }

  return isAdmin(user) ? 'All States' : 'Unassigned';
}
