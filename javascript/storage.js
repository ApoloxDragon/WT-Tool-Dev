/* ---------- localStorage persistence helpers ---------- */
// Wrapped in try/catch since localStorage can throw (private browsing,
// disabled storage, quota exceeded) — persistence is a nice-to-have,
// never something the rest of the app should crash over.
const STORAGE_PREFIX = 'wtSessionReadout.';

function saveState(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) { /* ignore — persistence just won't happen this time */ }
}

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function clearState(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (err) { /* ignore */ }
}
