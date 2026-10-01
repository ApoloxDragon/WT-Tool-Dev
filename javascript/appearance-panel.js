/* ---------- Colour & text panel ---------- */
// The "Customise" drawer: pick a preset, change any of the nine colours, choose font style
// and text size, and keep your own named presets. Built with DOM calls only (no HTML
// strings), so nothing a user types can ever be interpreted as markup.
// Depends on: themes.js (Appearance state + rules), raw-export.js (downloadBlob,
// localTimestampForFilename), tutorial.js (optional, for the "How this works" tour).

(function () {
  const h = (tag, props, ...kids) => {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    });
    kids.flat().forEach(c => { if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return node;
  };

  let draft = { ...appearance.colours };   // what the colour boxes show (may be unreadable, i.e. not applied yet)
  let ownChange = false;                   // true while this panel is the one changing the appearance
  let panel = null, opener = null;
  const els = {};                          // named references to the panel's controls

  /* ----- building the panel ----- */
  function buildPanel() {
    const roleRows = group => COLOUR_ROLES.filter(r => r.group === group).map(r => {
      const color = h('input', { type: 'color', id: `cp-${r.key}-color`, 'aria-label': `${r.label} colour picker` });
      const hex = h('input', { type: 'text', id: `cp-${r.key}-hex`, maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': `${r.label} as #rrggbb` });
      els[r.key] = { color, hex };
      color.addEventListener('input', () => setDraft(r.key, color.value));
      // While typing, apply only a complete #rrggbb (a half-typed "#fff" must not flash white);
      // shorthand like #abc is accepted when you press Enter or leave the box.
      hex.addEventListener('input', () => {
        const full = /^#?[0-9a-f]{6}$/i.test(hex.value.trim());
        hex.setAttribute('aria-invalid', full || normHex(hex.value) || hex.value === '' ? 'false' : 'true');
        if (full) setDraft(r.key, normHex(hex.value), { fromHex: true });
      });
      const commitHex = () => {
        const v = normHex(hex.value);
        if (v && v !== draft[r.key]) setDraft(r.key, v, { fromHex: true });
        hex.value = draft[r.key];
        hex.setAttribute('aria-invalid', 'false');
      };
      hex.addEventListener('blur', commitHex);
      hex.addEventListener('keydown', e => { if (e.key === 'Enter') commitHex(); });
      return h('div', { class: 'cp-role', 'data-role': r.key },
        h('div', { class: 'cp-role-text' }, h('span', { class: 'cp-role-name', text: r.label }), h('span', { class: 'cp-role-about', text: r.about })),
        color, hex);
    });
    const groups = ['Surfaces', 'Text', 'Accent & results'].map(g =>
      h('div', { class: 'cp-group', 'data-group': g }, h('h3', { class: 'sub', text: g }), roleRows(g)));

    els.preset = h('select', { id: 'cpPreset', 'aria-describedby': 'cpModified' });
    els.modified = h('span', { id: 'cpModified', class: 'note' });
    els.resetPreset = h('button', { type: 'button', id: 'cpResetPreset', class: 'secondary small', text: 'Reset to preset', onclick: onResetPreset });
    els.blocked = h('div', { class: 'cp-alert', role: 'alert', hidden: true });
    els.contrast = h('ul', { class: 'cp-contrast' });
    els.contrastNote = h('div', { class: 'note' });

    const radios = (name, options, current, onPick) => h('div', { class: 'cp-radios', role: 'radiogroup', 'aria-label': name },
      Object.entries(options).map(([key, o]) => h('label', { class: 'cp-radio' },
        h('input', { type: 'radio', name: 'cp-' + name, value: key, checked: key === current, onchange: () => onPick(key) }), ' ' + o.label)));
    els.fontRadios = radios('Font style', FONT_STYLES, appearance.font, key => setAppearance({ font: key }));
    els.sizeRadios = radios('Text size', TEXT_SIZES, appearance.size, key => setAppearance({ size: key }));

    els.name = h('input', { type: 'text', id: 'cpName', maxlength: String(NAME_MAX + 10), placeholder: 'Name, e.g. Azul océano', autocomplete: 'off', 'aria-label': 'Name for your preset', 'aria-describedby': 'cpNameMsg' });
    els.name.addEventListener('keydown', e => { if (e.key === 'Enter') onSave(); });
    els.nameMsg = h('div', { id: 'cpNameMsg', class: 'note', role: 'status' });
    els.anyChars = h('input', { type: 'checkbox', id: 'cpAnyChars', onchange: () => { setAllowAnyNameChars(els.anyChars.checked); els.nameMsg.textContent = ''; } });
    els.myList = h('ul', { class: 'cp-mylist' });
    els.count = h('div', { class: 'note' });
    els.unlock = h('input', { type: 'checkbox', id: 'cpUnlock', onchange: onUnlockToggle });
    els.unlockBox = h('div', { class: 'cp-alert', hidden: true },
      h('p', { text: `Saving more than ${PRESET_LIMIT_DEFAULT} presets is at your own risk: they use more of this browser’s storage, the list gets long and hard to manage, and deleting a preset can’t be undone. The most you can keep is ${PRESET_LIMIT_UNLOCKED}.` }),
      h('div', { class: 'cp-row' },
        h('button', { type: 'button', class: 'small', text: `Yes, allow up to ${PRESET_LIMIT_UNLOCKED}`, onclick: () => { setPresetLimitUnlocked(true); els.unlockBox.hidden = true; renderMine(); } }),
        h('button', { type: 'button', class: 'secondary small', text: 'Cancel', onclick: () => { els.unlock.checked = false; els.unlockBox.hidden = true; } })));
    els.importFile = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a colour-presets file to import', onchange: onImportFile });
    els.fileMsg = h('div', { id: 'cpFileMsg', class: 'note', role: 'status' });

    panel = h('aside', { id: 'colourPanel', class: 'colour-panel', role: 'dialog', 'aria-labelledby': 'cpTitle', hidden: true },
      h('div', { class: 'cp-head' }, h('h2', { id: 'cpTitle', text: 'Colours & text' }),
        h('button', { type: 'button', class: 'secondary small', id: 'cpClose', text: 'Close ✕', onclick: closePanel })),
      h('div', { class: 'cp-body' },
        h('section', { class: 'cp-sec', id: 'cpPresetSec' },
          h('label', { for: 'cpPreset', class: 'cp-label', text: 'Start from a preset' }), els.preset,
          h('div', { class: 'cp-row' }, els.resetPreset, els.modified)),
        els.blocked,
        h('section', { class: 'cp-sec', id: 'cpColourSec' }, h('h3', { class: 'cp-h', text: 'Colours' }), groups),
        h('section', { class: 'cp-sec', id: 'cpContrastSec' }, h('h3', { class: 'cp-h', text: 'Readability' }), els.contrast, els.contrastNote),
        h('section', { class: 'cp-sec', id: 'cpFontSec' }, h('h3', { class: 'cp-h', text: 'Text' }),
          h('div', { class: 'cp-label', text: 'Font style' }), els.fontRadios,
          h('div', { class: 'cp-label', text: 'Text size' }), els.sizeRadios,
          h('p', { class: 'cp-preview', text: 'Victory in the [Domination] Sweden mission! — 22,571 SL, 8,541 RP' })),
        h('section', { class: 'cp-sec', id: 'cpMineSec' }, h('h3', { class: 'cp-h', text: 'My presets' }),
          h('div', { class: 'cp-row' }, els.name, h('button', { type: 'button', id: 'cpSave', text: 'Save as my preset', onclick: onSave })),
          els.nameMsg,
          h('label', { class: 'cp-check' }, els.anyChars, ' Allow other characters in names'),
          els.myList, els.count,
          h('label', { class: 'cp-check' }, els.unlock, ` Allow up to ${PRESET_LIMIT_UNLOCKED} presets (at your own risk)`), els.unlockBox,
          h('div', { class: 'cp-row' },
            h('button', { type: 'button', class: 'secondary small', id: 'cpExport', text: 'Export my presets', onclick: onExport }),
            h('button', { type: 'button', class: 'secondary small', id: 'cpImport', text: 'Import…', onclick: () => els.importFile.click() }), els.importFile),
          els.fileMsg),
        h('section', { class: 'cp-sec', id: 'cpEndSec' }, h('div', { class: 'cp-row' },
          h('button', { type: 'button', class: 'secondary danger small', id: 'cpResetAll', text: 'Reset everything to default', onclick: onResetAll }),
          h('button', { type: 'button', class: 'secondary small', id: 'cpHelp', text: '? How this works', onclick: onHelp })))));
    document.body.appendChild(panel);
    panel.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('.tut-card')) closePanel(); });
  }

  /* ----- keeping the controls in step with the state ----- */
  function renderPresetSelect() {
    const sel = els.preset;
    sel.textContent = '';
    const builtIn = h('optgroup', { label: 'Built-in' }, BUILTIN_PRESETS.map(p => h('option', { value: p.id, text: p.name })));
    sel.appendChild(builtIn);
    if (myPresets.length) sel.appendChild(h('optgroup', { label: 'My presets' }, myPresets.map(p => h('option', { value: 'my:' + p.id, text: p.name }))));
    if (!basePreset()) sel.prepend(h('option', { value: '', text: 'Custom colours', disabled: true }));
    sel.value = basePreset() ? appearance.presetId : '';
  }
  function renderColourInputs() {
    COLOUR_KEYS.forEach(k => { els[k].color.value = draft[k]; if (document.activeElement !== els[k].hex) els[k].hex.value = draft[k]; });
  }
  function renderContrast() {
    const ev = evaluateColours(draft);
    els.contrast.textContent = '';
    ev.pairs.forEach(p => {
      const chip = h('span', { class: 'cp-chip', 'aria-hidden': 'true', text: 'Aa' });
      chip.style.color = draft[p.fg]; chip.style.background = draft[p.bg];
      const level = { ok: 'Good', weak: 'Weak', blocked: 'Too low' }[p.level];
      els.contrast.appendChild(h('li', { class: 'cp-' + p.level }, chip, h('span', { class: 'cp-pair', text: p.label }),
        h('strong', { text: p.ratio.toFixed(1) + ':1' }), h('span', { class: 'cp-level', text: level })));
    });
    els.contrastNote.textContent = ev.blocked.length ? '' : ev.weak.length
      ? `${ev.weak.length} pair${ev.weak.length > 1 ? 's are' : ' is'} readable but weak (under ${CONTRAST_OK}:1) — that is allowed.`
      : 'Every pair is comfortably readable.';
    if (ev.blocked.length) {
      const names = ev.blocked.slice(0, 3).map(p => `${p.label} (${p.ratio.toFixed(1)}:1)`).join(', ');
      els.blocked.textContent = `Not applied yet — too hard to read: ${names}. Colours need at least ${CONTRAST_BLOCK}:1 against what they sit on. Adjust them and the new colours apply automatically once every pair passes.`;
      els.blocked.hidden = false;
    } else els.blocked.hidden = true;
  }
  function renderModified() {
    const b = basePreset();
    const pending = evaluateColours(draft).blocked.length > 0;
    els.modified.textContent = pending ? 'Edits not applied yet' : (b ? (isModified() ? `Modified from “${b.name}”` : `Matches “${b.name}”`) : 'Custom colours');
    els.resetPreset.disabled = !b || (!isModified() && !pending);
  }
  function renderMine() {
    els.myList.textContent = '';
    myPresets.forEach(p => els.myList.appendChild(presetRow(p)));
    els.count.textContent = !myPresets.length ? 'No saved presets yet. Change colours, give them a name, and save.'
      : myPresets.length > presetLimit() ? `${myPresets.length} saved presets — over the normal limit of ${presetLimit()}; delete some to save new ones.`
      : `${myPresets.length} of ${presetLimit()} saved presets.`;
    els.unlock.checked = presetLimitUnlocked;
    els.anyChars.checked = allowAnyNameChars;
  }
  function renderFonts() {
    els.fontRadios.querySelectorAll('input').forEach(i => { i.checked = i.value === appearance.font; });
    els.sizeRadios.querySelectorAll('input').forEach(i => { i.checked = i.value === appearance.size; });
  }
  function renderAll() {
    draft = { ...appearance.colours };
    renderPresetSelect(); renderColourInputs(); renderContrast(); renderModified(); renderMine(); renderFonts();
  }

  /* ----- actions ----- */
  function setDraft(role, value, { fromHex } = {}) {
    draft = { ...draft, [role]: value };
    if (!fromHex) els[role].hex.value = value;
    else els[role].color.value = value;
    renderContrast();
    const ev = evaluateColours(draft);
    if (!ev.blocked.length) { ownChange = true; tryApplyColours(draft); ownChange = false; renderPresetSelect(); }
    renderModified();
  }
  function onPresetChange() {
    if (!els.preset.value) return;
    ownChange = true; applyPresetById(els.preset.value); ownChange = false;
    renderAll();
  }
  function onResetPreset() { ownChange = true; resetToBasePreset(); ownChange = false; renderAll(); }
  function onResetAll() { ownChange = true; resetAppearanceToDefault(); ownChange = false; renderAll(); els.fileMsg.textContent = ''; els.nameMsg.textContent = ''; }
  function onHelp() { if (typeof Tutorial !== 'undefined') Tutorial.start('colours'); }

  function onSave() {
    const r = saveCurrentAsPreset(els.name.value);
    if (!r.ok) {
      els.nameMsg.textContent = r.error;
      els.name.setAttribute('aria-invalid', 'true');
      if (r.limit && !presetLimitUnlocked) els.unlock.focus();
      return;
    }
    els.name.value = ''; els.name.setAttribute('aria-invalid', 'false');
    els.nameMsg.textContent = 'Saved.';
    renderAll();
  }
  function onUnlockToggle() {
    if (els.unlock.checked) els.unlockBox.hidden = false;       // ask first — nothing changes until they confirm
    else { setPresetLimitUnlocked(false); els.unlockBox.hidden = true; renderMine(); }
  }

  function presetRow(p) {
    const row = h('li', { class: 'cp-myrow', 'data-id': p.id });
    const show = () => {
      row.textContent = '';
      const dot = h('span', { class: 'cp-dot', 'aria-hidden': 'true' });
      dot.style.background = `linear-gradient(135deg, ${p.colours.bg} 50%, ${p.colours.accent} 50%)`;
      let armed = false, timer = null;
      const del = h('button', { type: 'button', class: 'secondary small danger', text: 'Delete', 'aria-label': `Delete ${p.name}` });
      del.addEventListener('click', () => {
        if (!armed) { armed = true; del.textContent = 'Sure?'; timer = setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 4000); return; }
        clearTimeout(timer); ownChange = true; deleteMyPreset(p.id); ownChange = false; renderAll();
      });
      row.append(dot, h('span', { class: 'cp-myname', text: p.name }),
        h('button', { type: 'button', class: 'secondary small', text: 'Use', 'aria-label': `Use ${p.name}`, onclick: () => { ownChange = true; applyPresetById('my:' + p.id); ownChange = false; renderAll(); } }),
        h('button', { type: 'button', class: 'secondary small', text: 'Rename', 'aria-label': `Rename ${p.name}`, onclick: edit }), del);
    };
    const edit = () => {
      row.textContent = '';
      const input = h('input', { type: 'text', value: p.name, maxlength: String(NAME_MAX + 10), 'aria-label': 'New name' });
      const msg = h('div', { class: 'note', role: 'status' });
      const commit = () => { const r = renameMyPreset(p.id, input.value); if (r.ok) renderAll(); else msg.textContent = r.error; };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { e.stopPropagation(); show(); } });
      row.append(input, h('button', { type: 'button', class: 'small', text: 'Save', onclick: commit }),
        h('button', { type: 'button', class: 'secondary small', text: 'Cancel', onclick: show }), msg);
      input.focus(); input.select();
    };
    show();
    return row;
  }

  function onExport() {
    if (!myPresets.length) { els.fileMsg.textContent = 'You have no saved presets to export yet.'; return; }
    downloadBlob(new Blob([JSON.stringify(exportMyPresetsObject(), null, 1)], { type: 'application/json' }), `wt-colour-presets-${localTimestampForFilename(new Date())}.json`);
    els.fileMsg.textContent = `Exported ${myPresets.length} preset${myPresets.length > 1 ? 's' : ''}.`;
  }
  async function onImportFile() {
    const file = els.importFile.files[0];
    els.importFile.value = '';
    if (!file) return;
    if (file.size > PRESET_FILE_MAX_BYTES) { els.fileMsg.textContent = 'That file is too large to be a colour-presets file (limit 1 MB).'; return; }
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { els.fileMsg.textContent = 'That file isn’t valid JSON.'; return; }
    const r = importMyPresetsObject(obj);
    if (r.error) { els.fileMsg.textContent = r.error; return; }
    const skipped = [
      r.skippedName && `${r.skippedName} with a name that isn’t allowed`, r.skippedColours && `${r.skippedColours} with invalid colours`,
      r.skippedUnreadable && `${r.skippedUnreadable} with unreadable colours`, r.skippedLimit && `${r.skippedLimit} over the limit of ${presetLimit()}`
    ].filter(Boolean);
    els.fileMsg.textContent = `Imported ${r.added} preset${r.added === 1 ? '' : 's'}` + (r.renamed ? ` (${r.renamed} renamed to avoid duplicates)` : '')
      + (skipped.length ? ` — skipped: ${skipped.join(', ')}.` : '.');
    renderAll();
  }

  /* ----- opening and closing ----- */
  function openPanel() {
    if (!panel) build();
    renderAll();
    panel.hidden = false;
    document.body.classList.add('cp-open');
    opener.setAttribute('aria-expanded', 'true');
    els.preset.focus();
  }
  function closePanel() {
    if (!panel || panel.hidden) return;
    // Anything still unreadable was never applied; drop it so the boxes match what you see.
    draft = { ...appearance.colours };
    panel.hidden = true;
    document.body.classList.remove('cp-open');
    opener.setAttribute('aria-expanded', 'false');
    opener.focus();
  }
  function build() {
    buildPanel();
    els.preset.addEventListener('change', onPresetChange);
  }

  // Changes made elsewhere (e.g. a swatch in the top bar) while the panel is open.
  onAppearanceChange(() => { if (panel && !panel.hidden && !ownChange) renderAll(); });

  /* ----- the button in the top bar ----- */
  const picker = document.getElementById('themePicker');
  if (picker) {
    opener = h('button', { type: 'button', class: 'tut-btn', id: 'colourBtn', 'aria-expanded': 'false', 'aria-controls': 'colourPanel', title: 'Change any colour, the font and the text size', text: 'Customise…' });
    opener.addEventListener('click', () => (panel && !panel.hidden) ? closePanel() : openPanel());
    picker.appendChild(opener);
  }
  window.ColourPanel = { open: () => opener && openPanel(), close: closePanel };
})();
