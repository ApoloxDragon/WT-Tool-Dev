/* ---------- Shared helpers (loaded first) ---------- */

// Makes text safe to place inside HTML — element content AND quoted attribute
// values. Anything that came from a pasted log, an imported file or saved
// settings must go through this before it is put in an innerHTML string.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"'`]/g, c => HTML_ESCAPES[c]);
}

// JSON that is safe to drop inside an inline <script> block (a literal "</script>"
// or "<!--" in a value can't end the block, U+2028/2029 can't break the literal).
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/* ---------- Limits ---------- */
// Real logs are nowhere near these (longest line 175 chars, largest match 8.5 KB);
// they exist so a hostile or corrupt file can't freeze or exhaust the tab.
const LIMITS = {
  MAX_LINE: 2000,                      // characters kept per log line
  MAX_BLOCK: 256 * 1024,               // characters in one archived match
  MAX_IMPORT_FILE: 150 * 1024 * 1024,  // bytes accepted from a chosen file
  MAX_UNPACKED: 128 * 1024 * 1024,     // bytes a .gz import may expand to
  MAX_IMPORT_MATCHES: 100000,          // matches taken from one import
  MAX_TEXT: 200,                       // characters kept per name / mission / category
  MAX_TARGETS: 50                      // research targets kept per match
};

class WtLimitError extends Error {}

const fmtMB = bytes => (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1) + ' MB';

// Keeps only the first MAX_LINE characters of every line. Everything downstream
// is then bounded per line, so no pattern can be made to run away on one long line.
function capLines(text) {
  if (text.length <= LIMITS.MAX_LINE) return text;
  // Fast scan first (no copying): real logs never have a long line, so this is all they cost.
  let tooLong = false;
  for (let pos = 0; pos < text.length;) {
    let nl = text.indexOf('\n', pos);
    if (nl === -1) nl = text.length;
    if (nl - pos > LIMITS.MAX_LINE) { tooLong = true; break; }
    pos = nl + 1;
  }
  if (!tooLong) return text;
  const lines = text.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > LIMITS.MAX_LINE) { lines[i] = lines[i].slice(0, LIMITS.MAX_LINE); changed = true; }
  }
  return changed ? lines.join('\n') : text;
}

/* ---------- Sanitising match data from outside ---------- */
// Imported files and saved settings can hold anything. Every match that comes
// from one is rebuilt through here so the rest of the app only ever sees
// well-typed, bounded data. Returns null for something that isn't a match.
const SESSION_ID_RE = /^(?:[a-f0-9]{1,64}|noid-\d{1,6})$/i; // same shape parseLog accepts

function clipText(v, max) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  return typeof v === 'string' ? v.slice(0, max || LIMITS.MAX_TEXT) : '';
}
function cleanNum(v, max) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : NaN);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), max || 1e9) : 0;
}
function cleanTargets(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, LIMITS.MAX_TARGETS)) {
    if (!x || typeof x !== 'object') continue;
    const name = clipText(x.name, 120);
    if (name) out.push({ name, rp: cleanNum(x.rp) });
  }
  return out;
}

function sanitizeMatch(m) {
  if (!m || typeof m !== 'object') return null;
  const sessionId = typeof m.sessionId === 'string' ? m.sessionId : '';
  if (!SESSION_ID_RE.test(sessionId)) return null;
  const category = clipText(m.category) || 'Random Battles';
  return {
    sessionId,
    result: m.result === 'Victory' ? 'Victory' : 'Defeat',
    mode: clipText(m.mode) || category,
    category,
    mission: clipText(m.mission),
    netSL: cleanNum(m.netSL),
    totalRP: cleanNum(m.totalRP),
    timeSec: cleanNum(m.timeSec, 1e6),
    researched: cleanTargets(m.researched),
    researching: cleanTargets(m.researching)
  };
}

// For loadState(): rebuilds a saved match list, dropping anything invalid.
function sanitizeMatchList(v) {
  if (!Array.isArray(v)) return undefined;
  return v.slice(0, LIMITS.MAX_IMPORT_MATCHES).map(sanitizeMatch).filter(Boolean);
}
