/* ---------- Appearance: colour presets, custom colours, font style and size ---------- */
// Depends on: util.js (esc), storage.js (loadState/saveState).
//
// What is stored (all under the wtSessionReadout. prefix):
//   appearance  { v, presetId, colours{9 roles}, font, size }  the ACTIVE look — includes unsaved edits
//   myPresets   [{ id, name, colours{9 roles} }]               the user's own named presets
//   presetLimitUnlocked  true once the user accepts more than the default limit
//   allowAnyNameChars    true if the user relaxed the Latin-letters rule for preset names
//   theme       legacy: a built-in preset name, still written (for the original four) because
//               the stable site shares this origin's storage and only understands those names.
//
// Every colour is validated as #rrggbb before it is stored, applied or exported, and is
// only ever set through CSS custom properties — never spliced into a style string.

/* ----- the nine colour roles ----- */
const COLOUR_ROLES = [
  { key: 'bg',     label: 'Background', group: 'Surfaces',         about: 'The page behind everything, including the dotted pattern’s backdrop.' },
  { key: 'panel',  label: 'Panel',      group: 'Surfaces',         about: 'Boxes: the paste area, stat tiles, the goal calculator and this colour panel.' },
  { key: 'panel2', label: 'Panel 2',    group: 'Surfaces',         about: 'The second layer: inputs, table headers, hovered rows, detail sections.' },
  { key: 'border', label: 'Border',     group: 'Surfaces',         about: 'Lines between rows, box outlines and the dotted page pattern.' },
  { key: 'text',   label: 'Text',       group: 'Text',             about: 'Main text: table cells, numbers, names and field contents.' },
  { key: 'dim',    label: 'Dim text',   group: 'Text',             about: 'Secondary text: labels, hints, column headings and notes.' },
  { key: 'accent', label: 'Accent',     group: 'Accent & results', about: 'Highlights: headings, big numbers, primary buttons, links and active items.' },
  { key: 'win',    label: 'Win',        group: 'Accent & results', about: 'The word Victory and other win highlights.' },
  { key: 'loss',   label: 'Loss',       group: 'Accent & results', about: 'The word Defeat, warnings, errors and the dev banner.' }
];
const COLOUR_KEYS = COLOUR_ROLES.map(r => r.key);

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

/* ----- readability rules ----- */
// Below 3:1 a pair is unreadable and the set is refused; 3–4.5:1 is allowed with a warning.
const CONTRAST_BLOCK = 3, CONTRAST_OK = 4.5;
const CONTRAST_PAIRS = [
  ['text', 'bg', 'Text on background'], ['text', 'panel', 'Text on panels'], ['text', 'panel2', 'Text on panel 2'],
  ['dim', 'bg', 'Dim text on background'], ['dim', 'panel', 'Dim text on panels'], ['dim', 'panel2', 'Dim text on panel 2'],
  ['accent', 'bg', 'Accent on background'], ['accent', 'panel', 'Accent on panels'],
  ['win', 'bg', 'Win on background'], ['win', 'panel', 'Win on panels'],
  ['loss', 'bg', 'Loss on background'], ['loss', 'panel', 'Loss on panels']
];
function evaluateColours(c) {
  const pairs = CONTRAST_PAIRS.map(([fg, bg, label]) => {
    const ratio = contrastRatio(c[fg], c[bg]);
    return { fg, bg, label, ratio, level: ratio < CONTRAST_BLOCK ? 'blocked' : ratio < CONTRAST_OK ? 'weak' : 'ok' };
  });
  return { pairs, blocked: pairs.filter(p => p.level === 'blocked'), weak: pairs.filter(p => p.level === 'weak') };
}

/* ----- names of saved presets ----- */
// Default rule: English + Spanish letters. `allowOther` (a user setting) relaxes it, but
// control / invisible / direction-changing characters are never allowed.
const NAME_MAX = 30;
const LATIN_NAME_RE = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ¿¡ .,:;'’\-_()!?]+$/;
function checkName(raw, allowOther) {
  const name = String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Give the preset a name.' };
  if (name.length > NAME_MAX) return { ok: false, error: `Names can be up to ${NAME_MAX} characters.` };
  if (/[\p{C}\p{Zl}\p{Zp}]/u.test(name)) return { ok: false, error: 'Names can’t contain control or invisible characters.' };
  if (!allowOther && !LATIN_NAME_RE.test(name)) {
    return { ok: false, error: 'Use English or Spanish letters (A–Z, á é í ó ú ü ñ), numbers, spaces and basic punctuation — or turn on “Allow other characters in names”.' };
  }
  return { ok: true, name };
}

/* ----- preset limits ----- */
const PRESET_LIMIT_DEFAULT = 20;
const PRESET_LIMIT_UNLOCKED = 100; // even when the user accepts the risk, there is a ceiling

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

function sanitizeMyPresets(v) {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set(), out = [];
  for (const p of v.slice(0, PRESET_LIMIT_UNLOCKED)) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(p.id) || seen.has(p.id)) continue;
    const name = checkName(p.name, true); // already-saved names are accepted as long as they are safe
    const colours = cleanColours(p.colours);
    if (!name.ok || !colours) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: name.name, colours });
  }
  return out;
}

function initialAppearance() {
  const saved = loadState('appearance', null, sanitizeAppearance);
  if (saved) return saved;
  // First run after this feature arrived: carry over the old single "theme" choice.
  const legacy = loadState('theme', null, v => (typeof v === 'string' && ORIGINAL_PRESET_IDS.includes(v)) ? v : undefined);
  const id = legacy || DEFAULT_PRESET_ID;
  return { presetId: id, colours: { ...presetById(id).colours }, font: 'mono', size: 'medium' };
}

let appearance = initialAppearance();
let myPresets = loadState('myPresets', [], sanitizeMyPresets);
let presetLimitUnlocked = loadState('presetLimitUnlocked', false, v => v === true ? true : undefined);
let allowAnyNameChars = loadState('allowAnyNameChars', false, v => v === true ? true : undefined);

const presetLimit = () => presetLimitUnlocked ? PRESET_LIMIT_UNLOCKED : PRESET_LIMIT_DEFAULT;

// The preset the current colours started from (built-in or one of the user's), if it still exists.
function basePreset() {
  const id = appearance.presetId;
  if (!id) return null;
  if (id.startsWith('my:')) { const m = myPresets.find(p => 'my:' + p.id === id); return m ? { id, name: m.name, colours: m.colours } : null; }
  return presetById(id);
}
const sameColours = (a, b) => COLOUR_KEYS.every(k => a[k] === b[k]);
function isModified() {
  const b = basePreset();
  return !b || !sameColours(b.colours, appearance.colours);
}

/* ----- saving (debounced: the colour picker fires many events while dragging) ----- */
let saveTimer = null;
function saveAppearanceNow() {
  clearTimeout(saveTimer); saveTimer = null;
  saveState('appearance', { v: 1, presetId: appearance.presetId, colours: appearance.colours, font: appearance.font, size: appearance.size });
  // The stable site shares this storage and only knows the original four preset names.
  if (ORIGINAL_PRESET_IDS.includes(appearance.presetId) && !isModified()) saveState('theme', appearance.presetId);
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveAppearanceNow, 200); }
window.addEventListener('pagehide', () => { if (saveTimer) saveAppearanceNow(); });

/* ----- applying to the page ----- */
const appearanceListeners = [];
function onAppearanceChange(fn) { appearanceListeners.push(fn); }

function applyAppearance() {
  const c = appearance.colours, root = document.documentElement.style;
  root.setProperty('--bg', c.bg); root.setProperty('--panel', c.panel); root.setProperty('--panel-2', c.panel2);
  root.setProperty('--border', c.border); root.setProperty('--accent', c.accent);
  root.setProperty('--text', c.text); root.setProperty('--dim', c.dim);
  root.setProperty('--win', c.win); root.setProperty('--loss', c.loss);
  root.setProperty('--on-accent', onColour(c.accent));
  root.setProperty('--on-loss', onColour(c.loss));
  root.setProperty('--font', FONT_STYLES[appearance.font].stack);
  root.setProperty('--text-scale', String(TEXT_SIZES[appearance.size].scale));
  root.colorScheme = relLuminance(c.bg) > 0.4 ? 'light' : 'dark'; // so native controls and scrollbars match
  appearanceListeners.forEach(fn => fn());
}

/* ----- changing it ----- */
function setAppearance(patch, { save = true } = {}) {
  appearance = { ...appearance, ...patch };
  applyAppearance();
  if (save) scheduleSave();
}
function applyPresetById(id) {
  const p = id.startsWith('my:') ? basePresetFor(id) : presetById(id);
  if (!p) return false;
  setAppearance({ presetId: id, colours: { ...p.colours } });
  return true;
}
function basePresetFor(id) {
  const m = myPresets.find(p => 'my:' + p.id === id);
  return m ? { id, name: m.name, colours: m.colours } : null;
}
// Applies a colour set if it is readable. Returns { ok, blocked } — nothing changes when blocked.
function tryApplyColours(colours) {
  const c = cleanColours(colours);
  if (!c) return { ok: false, blocked: [], invalid: true };
  const ev = evaluateColours(c);
  if (ev.blocked.length) return { ok: false, blocked: ev.blocked };
  setAppearance({ colours: c });
  return { ok: true, weak: ev.weak };
}
function resetToBasePreset() {
  const b = basePreset();
  if (b) setAppearance({ colours: { ...b.colours } });
  return !!b;
}
function resetAppearanceToDefault() {
  setAppearance({ presetId: DEFAULT_PRESET_ID, colours: { ...presetById(DEFAULT_PRESET_ID).colours }, font: 'mono', size: 'medium' });
}

/* ----- the user's own presets ----- */
function newPresetId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function saveMyPresets() { saveState('myPresets', myPresets); }
const nameTaken = (name, exceptId) => myPresets.some(p => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());

function saveCurrentAsPreset(rawName) {
  const n = checkName(rawName, allowAnyNameChars);
  if (!n.ok) return n;
  if (myPresets.length >= presetLimit()) return { ok: false, error: `You have ${myPresets.length} saved presets — the limit is ${presetLimit()}.`, limit: true };
  if (nameTaken(n.name)) return { ok: false, error: 'You already have a preset with that name.' };
  const ev = evaluateColours(appearance.colours);
  if (ev.blocked.length) return { ok: false, error: 'These colours are too hard to read to save as a preset.' };
  const id = newPresetId();
  myPresets.push({ id, name: n.name, colours: { ...appearance.colours } });
  saveMyPresets();
  setAppearance({ presetId: 'my:' + id }, { save: true });
  return { ok: true, id };
}
function renameMyPreset(id, rawName) {
  const n = checkName(rawName, allowAnyNameChars);
  if (!n.ok) return n;
  const p = myPresets.find(x => x.id === id);
  if (!p) return { ok: false, error: 'That preset no longer exists.' };
  if (nameTaken(n.name, id)) return { ok: false, error: 'You already have a preset with that name.' };
  p.name = n.name; saveMyPresets(); applyAppearance();
  return { ok: true };
}
function deleteMyPreset(id) {
  myPresets = myPresets.filter(p => p.id !== id);
  saveMyPresets();
  if (appearance.presetId === 'my:' + id) setAppearance({ presetId: null }); // colours stay; they just have no base now
  else applyAppearance();
}
function setPresetLimitUnlocked(on) { presetLimitUnlocked = !!on; saveState('presetLimitUnlocked', presetLimitUnlocked); }
function setAllowAnyNameChars(on) { allowAnyNameChars = !!on; saveState('allowAnyNameChars', allowAnyNameChars); }

/* ----- export / import of the user's presets ----- */
const PRESET_FILE_FORMAT = 'wt-colour-presets';
const PRESET_FILE_MAX_BYTES = 1024 * 1024;
function exportMyPresetsObject() {
  return { format: PRESET_FILE_FORMAT, version: 1, presets: myPresets.map(p => ({ name: p.name, colours: p.colours })) };
}
// Imported data is never trusted: each preset is rebuilt from a validated name and a validated,
// readable colour set; ids are always generated here.
function importMyPresetsObject(obj) {
  const res = { added: 0, skippedName: 0, skippedColours: 0, skippedUnreadable: 0, skippedLimit: 0, renamed: 0 };
  if (!obj || typeof obj !== 'object' || obj.format !== PRESET_FILE_FORMAT || !Array.isArray(obj.presets)) return { ...res, error: 'That is not a colour-presets file from this tool.' };
  for (const p of obj.presets.slice(0, PRESET_LIMIT_UNLOCKED * 2)) {
    if (myPresets.length >= presetLimit()) { res.skippedLimit++; continue; }
    if (!p || typeof p !== 'object') { res.skippedColours++; continue; }
    const colours = cleanColours(p.colours);
    if (!colours) { res.skippedColours++; continue; }
    if (evaluateColours(colours).blocked.length) { res.skippedUnreadable++; continue; }
    let n = checkName(p.name, allowAnyNameChars);
    if (!n.ok) { res.skippedName++; continue; }
    let name = n.name, i = 2;
    while (nameTaken(name)) { const suffix = ' ' + i++; name = n.name.slice(0, NAME_MAX - suffix.length) + suffix; res.renamed++; }
    myPresets.push({ id: newPresetId(), name, colours });
    res.added++;
  }
  if (res.added) saveMyPresets();
  return res;
}

/* ----- the swatch row in the top bar (the eight built-in presets) ----- */
function buildThemePicker() {
  const picker = document.getElementById('themePicker');
  if (!picker) return;
  BUILTIN_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.preset = p.id;
    btn.style.background = `linear-gradient(135deg, ${p.colours.bg} 50%, ${p.colours.accent} 50%)`;
    btn.title = p.name;
    btn.setAttribute('aria-label', `${p.name} colour preset`);
    btn.addEventListener('click', () => applyPresetById(p.id));
    picker.appendChild(btn);
  });
}
function syncSwatches() {
  const active = appearance.presetId && !isModified() ? appearance.presetId : null;
  document.querySelectorAll('#themePicker .swatch').forEach(s => {
    const on = s.dataset.preset === active;
    s.classList.toggle('active', on);
    s.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
onAppearanceChange(syncSwatches);

buildThemePicker();
applyAppearance(); // apply the restored (or default) look straight away
