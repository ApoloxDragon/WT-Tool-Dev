/* ---------- Appearance core: the look's data, and the instant it is applied ---------- */
// This file is loaded in the <head>, BEFORE the stylesheet and before the page body exists, and
// applies the saved look immediately (see the last lines). That is what stops the page flashing
// the default Blue — and fading from it — while it loads: by the time anything can be painted,
// the right colours, font and text size are already set.
//
// It has to stand alone (no other script is loaded yet), so it reads the saved settings straight
// from localStorage. themes.js builds the interactive parts (state, presets, swatches) on top of it.
// Keep it small and dependency-free: every millisecond here delays the first paint.

const COLOUR_KEYS = ['bg', 'panel', 'panel2', 'border', 'text', 'dim', 'accent', 'win', 'loss']; // same order as COLOUR_ROLES in themes.js

/* ----- the eight built-in presets (the first four are the originals, unchanged) ----- */
const BUILTIN_PRESETS = [
  { id: 'blue',     name: 'Blue',     colours: { bg: '#0d1420', panel: '#131b2b', panel2: '#182338', border: '#26344d', accent: '#4d9fe8', text: '#dbe6f2', dim: '#6f8299', win: '#7fbf6a', loss: '#d16158' } },
  { id: 'amber',    name: 'Amber',    colours: { bg: '#12130d', panel: '#1a1c14', panel2: '#21231a', border: '#3a3c2c', accent: '#d9a441', text: '#e8e4d5', dim: '#8b8d78', win: '#7fbf6a', loss: '#d16158' } },
  { id: 'slate',    name: 'Slate',    colours: { bg: '#16181c', panel: '#1e2126', panel2: '#262a30', border: '#383d44', accent: '#c9ced6', text: '#e4e7ea', dim: '#7d848d', win: '#7fbf6a', loss: '#d16158' } },
  { id: 'forest',   name: 'Forest',   colours: { bg: '#0f1712', panel: '#16211a', panel2: '#1c2921', border: '#2e402f', accent: '#6bbf7a', text: '#dcead9', dim: '#7b9a80', win: '#7fbf6a', loss: '#d16158' } },
  { id: 'crimson',  name: 'Crimson',  colours: { bg: '#170e10', panel: '#211519', panel2: '#2b1b20', border: '#4a2a32', accent: '#ec6a80', text: '#f3e3e6', dim: '#b58b93', win: '#86c98d', loss: '#f0906c' } },
  { id: 'violet',   name: 'Violet',   colours: { bg: '#120f1c', panel: '#1a1527', panel2: '#221c33', border: '#3b3260', accent: '#a78bfa', text: '#e6e0f7', dim: '#9a92bb', win: '#82c98a', loss: '#e8847a' } },
  { id: 'teal',     name: 'Teal',     colours: { bg: '#0b1718', panel: '#112123', panel2: '#172b2e', border: '#26494d', accent: '#2dd4bf', text: '#d8f1ee', dim: '#82aeab', win: '#86c98d', loss: '#e8897a' } },
  { id: 'daylight', name: 'Daylight', colours: { bg: '#f4f6f9', panel: '#ffffff', panel2: '#e8edf3', border: '#c4cdd9', accent: '#1d5fbf', text: '#1b2430', dim: '#556171', win: '#2b7a33', loss: '#b3261e' } }
];
const ORIGINAL_PRESET_IDS = ['blue', 'amber', 'slate', 'forest']; // the names the stable site understands
const DEFAULT_PRESET_ID = 'blue';
const presetById = id => BUILTIN_PRESETS.find(p => p.id === id) || null;

/* ----- font style and text size ----- */
const FONT_STYLES = {
  mono:  { label: 'Monospace',  stack: "'SF Mono', Consolas, Menlo, 'Courier New', monospace" },
  sans:  { label: 'Sans-serif', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  serif: { label: 'Serif',      stack: "Georgia, Cambria, 'Times New Roman', Times, serif" }
};
const TEXT_SIZES = {
  small:  { label: 'Small',  scale: 0.9 },
  medium: { label: 'Medium', scale: 1 },
  large:  { label: 'Large',  scale: 1.15 }
};

/* ----- colour maths (pure) ----- */
function normHex(v) {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (/^[0-9a-f]{6}$/i.test(s) || /^[0-9a-f]{3}$/i.test(s)) s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
}
function relLuminance(hex) {
  const ch = i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}
function contrastRatio(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// Text colour to put ON a coloured background (buttons, badges): whichever of near-black / white reads better.
function onColour(hex) {
  return contrastRatio(hex, '#08101c') >= contrastRatio(hex, '#ffffff') ? '#08101c' : '#ffffff';
}

// A complete, valid colour set, or null. Extra keys are dropped; every role must be a valid colour.
function cleanColours(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const k of COLOUR_KEYS) {
    const h = normHex(obj[k]);
    if (!h) return null;
    out[k] = h;
  }
  return out;
}


/* ----- what is saved ----- */
const APPEARANCE_STORAGE_PREFIX = 'wtSessionReadout.'; // same prefix as storage.js
function readSavedSetting(key) {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (err) { return undefined; } // blocked storage, or not valid JSON: behave as if nothing is saved
}

/* ----- stored state ----- */
function sanitizeAppearance(v) {
  if (!v || typeof v !== 'object') return undefined;
  const colours = cleanColours(v.colours);
  if (!colours) return undefined;
  const presetId = (typeof v.presetId === 'string' && (presetById(v.presetId) || /^my:[a-z0-9-]{1,40}$/.test(v.presetId))) ? v.presetId : null;
  return {
    presetId, colours,
    font: Object.prototype.hasOwnProperty.call(FONT_STYLES, v.font) ? v.font : 'mono',
    size: Object.prototype.hasOwnProperty.call(TEXT_SIZES, v.size) ? v.size : 'medium'
  };
}

function initialAppearance() {
  const saved = sanitizeAppearance(readSavedSetting('appearance'));
  if (saved) return saved;
  // Before this feature there was a single "theme" choice; carry it over.
  const legacy = readSavedSetting('theme');
  const id = (typeof legacy === 'string' && ORIGINAL_PRESET_IDS.includes(legacy)) ? legacy : DEFAULT_PRESET_ID;
  return { presetId: id, colours: { ...presetById(id).colours }, font: 'mono', size: 'medium' };
}

/* ----- putting a look on the page ----- */
// Only validated colours ever get here, and they are set as CSS custom properties — never spliced into a style string.
function paintAppearance(a) {
  const c = a.colours, root = document.documentElement.style;
  root.setProperty('--bg', c.bg); root.setProperty('--panel', c.panel); root.setProperty('--panel-2', c.panel2);
  root.setProperty('--border', c.border); root.setProperty('--accent', c.accent);
  root.setProperty('--text', c.text); root.setProperty('--dim', c.dim);
  root.setProperty('--win', c.win); root.setProperty('--loss', c.loss);
  root.setProperty('--on-accent', onColour(c.accent));
  root.setProperty('--on-loss', onColour(c.loss));
  root.setProperty('--font', FONT_STYLES[a.font].stack);
  root.setProperty('--text-scale', String(TEXT_SIZES[a.size].scale));
  root.colorScheme = relLuminance(c.bg) > 0.4 ? 'light' : 'dark'; // so native controls and scrollbars match
}

// Right now, while the page is still being parsed:
try { paintAppearance(initialAppearance()); } catch (err) { /* the stylesheet's default look applies */ }
