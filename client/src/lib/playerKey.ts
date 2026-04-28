const STORAGE_KEY = 'lazypoker:playerKey';

export function getPlayerKey(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode, storage disabled, etc. Use a session-scoped key so the
    // request still goes through with a stable value within this tab.
    return 'ephemeral-' + Math.random().toString(36).slice(2, 10);
  }
}
