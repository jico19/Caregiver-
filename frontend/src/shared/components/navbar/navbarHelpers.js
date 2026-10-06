export const DRAWER_ID = 'portal-mobile-nav';
export const USER_MENU_KEY = 'user';
export const USER_MENU_ID = 'portal-user-menu';

export function isRouteActive(pathname, to) {
  if (!to) return false;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function countFor(entry) {
  if (entry.items) {
    return entry.items.reduce(
      (total, item) => total + (item.hasBadge ? item.badgeCount ?? 0 : 0),
      0
    );
  }
  return entry.hasBadge ? entry.badgeCount ?? 0 : 0;
}

export function asLeaf(entry) {
  return entry.items ? entry.items[0] : entry;
}
