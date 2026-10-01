/* ---------- Appearance: colour presets, custom colours, font style and size ---------- */
// Depends on: appearance-core.js (loaded first, in the <head>: the presets, validation and painting),
// util.js (esc), storage.js (loadState/saveState).
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

// The look itself is painted by paintAppearance() in appearance-core.js (the same code that
// applies the saved look before first paint); this adds telling the rest of the app.
function applyAppearance() {
  paintAppearance(appearance);
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
