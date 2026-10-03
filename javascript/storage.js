/* ---------- localStorage persistence helpers ---------- */
// Wrapped in try/catch since localStorage can throw (private browsing,
// disabled storage, quota exceeded) — persistence is a nice-to-have,
// never something the rest of the app should crash over.
const STORAGE_PREFIX = WT_STORE + '.'; // WT_STORE: appearance-core.js (different on the dev site)

function saveState(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) { /* ignore — persistence just won't happen this time */ }
}

// `sanitize` (optional) checks/rebuilds whatever was saved — saved settings can be
// stale, corrupt or hand-edited, so callers that depend on a shape pass one. It
// returns the value to use, or undefined to fall back to the default.
function loadState(key, fallback, sanitize) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (!sanitize) return value;
    const clean = sanitize(value);
    return clean === undefined ? fallback : clean;
  } catch (err) {
    return fallback;
  }
}

function clearState(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (err) { /* ignore */ }
}
