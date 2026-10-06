export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DRAFT_STORAGE_KEY = 'caregiver_app_draft_v1';

export function saveDraft(identityKey, form) {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        identity: identityKey,
        form,
        savedAt: Date.now(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

// Returns the saved form only if it belongs to the same identity in this
// browser and hasn't expired. Stale drafts are wiped automatically.
export function loadDraft(identityKey) {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (payload && payload.identity !== identityKey) return null;

    const age = Date.now() - (payload?.savedAt || 0);
    if (age > DRAFT_TTL_MS) {
      clearDraft();
      return null;
    }
    return payload?.form || null;
  } catch {
    return null;
  }
}