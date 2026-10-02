/* Appearance suite: colour presets, the Customise panel, fonts, saved presets, import/export, reports. */
const fs = require('fs');
const { newPage, norm } = require('../harness');

const NAMES = ['Blue', 'Amber', 'Slate', 'Forest', 'Crimson', 'Violet', 'Teal', 'Daylight'];
const P = '#colourPanel';
const css = (page, v) => page.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), v);
const stored = (page, key) => page.evaluate(k => { const r = localStorage.getItem('wtSessionReadout.' + k); return r === null ? null : JSON.parse(r); }, key);
const settle = page => page.waitForTimeout(350);           // colour changes save after a short debounce
const hex = (page, role, v) => page.fill(`#cp-${role}-hex`, v);
async function open(browser, base, { view = 'wt-log-analyzer.html', init = null, panel = false, viewport } = {}) {
  const p = await newPage(browser, { init, viewport });
  await p.goto(base + view);
  if (panel) { await p.click('#colourBtn'); await p.waitForSelector(P + ':not([hidden])'); }
  return p;
}
async function dl(page, sel) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); return { name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8') }; }
const fileInput = `${P} input[type=file]`;

exports.run = async ({ browser, base, t }) => {
  /* ---------------- the eight presets ---------------- */
  t.scope('appearance › presets');
  let p = await open(browser, base);
  const presets = await p.evaluate(() => BUILTIN_PRESETS.map(x => ({ id: x.id, name: x.name, colours: x.colours })));
  t.check('there are exactly eight built-in presets, in this order', presets.map(x => x.name).join() === NAMES.join(), presets.map(x => x.name).join());
  t.check('the original four are unchanged (same colours as before)', JSON.stringify(presets.slice(0, 4).map(x => x.colours.bg + x.colours.accent)) === JSON.stringify(['#0d1420#4d9fe8', '#12130d#d9a441', '#16181c#c9ced6', '#0f1712#6bbf7a']));
  t.check('eight swatches sit in the top bar, each with a name', JSON.stringify(await p.$$eval('#themePicker .swatch', s => s.map(x => x.title))) === JSON.stringify(NAMES));
  const ev = await p.evaluate(() => BUILTIN_PRESETS.map(x => { const e = evaluateColours(x.colours); return { id: x.id, blocked: e.blocked.length, weak: e.weak.length, min: Math.min(...e.pairs.map(q => q.ratio)) }; }));
  t.check('no built-in preset has an unreadable colour pair (nothing under 3:1)', ev.every(x => x.blocked === 0), JSON.stringify(ev.filter(x => x.blocked)));
  t.check('the four new presets are comfortable everywhere (every pair 4.5:1 or better)', ev.slice(4).every(x => x.weak === 0), JSON.stringify(ev.slice(4).map(x => [x.id, x.min.toFixed(2)])));
  t.snapshot('contrast of every built-in preset (lowest ratio, rounded)', ev.map(x => x.id + ':' + x.min.toFixed(1)).join(','));
  await p.ctx.close();

  for (const pr of presets) {
    p = await open(browser, base);
    await p.click(`#themePicker .swatch[data-preset="${pr.id}"]`); await settle(p);
    const c = pr.colours;
    const applied = await p.evaluate(() => ['--bg', '--panel', '--panel-2', '--border', '--accent', '--text', '--dim', '--win', '--loss'].map(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim()).join());
    t.check(`${pr.name}: clicking its swatch applies all nine colours`, applied === [c.bg, c.panel, c.panel2, c.border, c.accent, c.text, c.dim, c.win, c.loss].join(), applied);
    t.check(`${pr.name}: the page background really is that colour`, await p.evaluate(v => getComputedStyle(document.body).backgroundColor === v, 'rgb(' + [1, 3, 5].map(i => parseInt(c.bg.slice(i, i + 2), 16)).join(', ') + ')'));
    t.check(`${pr.name}: is saved, and is what you get after a reload`, (await stored(p, 'appearance')).presetId === pr.id && (await (async () => { await p.reload(); return css(p, '--bg'); })()) === c.bg);
    t.check(`${pr.name}: its swatch is marked pressed, the others are not`, await p.evaluate(id => [...document.querySelectorAll('#themePicker .swatch')].every(s => (s.dataset.preset === id) === (s.getAttribute('aria-pressed') === 'true')), pr.id));
    t.check(`${pr.name}: text on buttons stays readable (auto dark/light)`, await p.evaluate(() => { const b = document.getElementById('analyzeBtn'), cs = getComputedStyle(b); const rgb = s => s.match(/\d+/g).slice(0, 3).map(Number); const lum = a => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(a[0]) + .7152 * f(a[1]) + .0722 * f(a[2]); }; const a = lum(rgb(cs.color)), bg = lum(rgb(cs.backgroundColor)); return (Math.max(a, bg) + .05) / (Math.min(a, bg) + .05) >= 4.5; }));
    t.check(`${pr.name}: native controls follow (${pr.id === 'daylight' ? 'light' : 'dark'} colour-scheme)`, (await p.evaluate(() => document.documentElement.style.colorScheme)) === (pr.id === 'daylight' ? 'light' : 'dark'));
    if (['blue', 'amber', 'slate', 'forest'].includes(pr.id)) t.check(`${pr.name}: also writes the legacy "theme" setting (the stable site reads it)`, (await stored(p, 'theme')) === pr.id);
    t.check(`${pr.name}: no uncaught errors`, p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();
  }
  p = await open(browser, base, { init: { fn: () => localStorage.setItem('wtSessionReadout.theme', JSON.stringify('forest')) } });
  t.check('an old saved "theme" setting is carried over (forest)', (await css(p, '--bg')) === '#0f1712');
  await p.click('#themePicker .swatch[data-preset="violet"]'); await settle(p);
  t.check('choosing a new preset leaves the legacy "theme" setting alone', (await stored(p, 'theme')) === 'forest');
  await p.ctx.close();

  /* ---------------- the Customise panel ---------------- */
  t.scope('appearance › panel');
  p = await open(browser, base, { panel: true });
  t.check('the panel opens as a labelled dialog and the button reports it is expanded', await p.evaluate(() => { const pn = document.getElementById('colourPanel'); return pn.getAttribute('role') === 'dialog' && !!document.getElementById(pn.getAttribute('aria-labelledby')) && document.getElementById('colourBtn').getAttribute('aria-expanded') === 'true'; }));
  t.check('focus moves into the panel when it opens', await p.evaluate(() => document.getElementById('colourPanel').contains(document.activeElement)));
  t.check('the preset list offers all eight built-in presets', JSON.stringify(await p.$$eval('#cpPreset optgroup:first-child option', o => o.map(x => x.textContent))) === JSON.stringify(NAMES));
  t.check('nine colour rows, each with a picker, a hex box and a one-line explanation', await p.evaluate(() => document.querySelectorAll('.cp-role').length === 9 && [...document.querySelectorAll('.cp-role')].every(r => r.querySelector('input[type=color]') && r.querySelector('input[type=text]') && r.querySelector('.cp-role-about').textContent.length > 15)));
  t.check('every control has an accessible name and no id is duplicated', await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const dup = ids.length !== new Set(ids).size; const unnamed = [...document.querySelectorAll('#colourPanel input, #colourPanel select, #colourPanel button')].filter(e => !(e.getAttribute('aria-label') || e.textContent.trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label'))); return !dup && unnamed.length === 0; }));
  await p.keyboard.press('Escape');
  t.check('Esc closes the panel and returns focus to the Customise button', !(await p.isVisible(P)) && (await p.evaluate(() => document.activeElement.id)) === 'colourBtn');
  await p.click('#colourBtn');
  await p.click('#cpClose'); t.check('the Close button closes it too', !(await p.isVisible(P)));
  await p.ctx.close();

  // every one of the nine colours can be changed, is applied at once, and is remembered
  const EDIT = { bg: '#101010', panel: '#1a1a1a', panel2: '#232323', border: '#555555', text: '#ffffff', dim: '#b0b8c4', accent: '#ffb000', win: '#66dd66', loss: '#ff7a7a' };
  const VAR = { bg: '--bg', panel: '--panel', panel2: '--panel-2', border: '--border', text: '--text', dim: '--dim', accent: '--accent', win: '--win', loss: '--loss' };
  for (const [role, value] of Object.entries(EDIT)) {
    p = await open(browser, base, { panel: true });
    await hex(p, role, value); await settle(p);
    t.check(`${role}: typing ${value} changes it on the page at once`, (await css(p, VAR[role])) === value, await css(p, VAR[role]));
    t.check(`${role}: the colour picker box follows`, (await p.inputValue(`#cp-${role}-color`)) === value);
    t.check(`${role}: is saved, marked as modified, and survives a reload`, (await stored(p, 'appearance')).colours[role] === value && /Modified from “Blue”/.test(await p.textContent('#cpModified')) && (await (async () => { await p.reload(); return css(p, VAR[role]); })()) === value);
    t.check(`${role}: no swatch claims to be active while the colours are customised`, (await p.$$('#themePicker .swatch[aria-pressed="true"]')).length === 0);
    await p.ctx.close();
  }

  p = await open(browser, base, { panel: true });
  await hex(p, 'accent', '#ffb000'); await settle(p);
  await p.click('#cpResetPreset'); await settle(p);
  t.check('"Reset to preset" puts the preset’s colours back', (await css(p, '--accent')) === '#4d9fe8' && /Matches “Blue”/.test(await p.textContent('#cpModified')));
  await p.selectOption('#cpPreset', 'violet'); await settle(p);
  t.check('picking a preset in the panel applies it and updates the boxes', (await css(p, '--bg')) === '#120f1c' && (await p.inputValue('#cp-bg-hex')) === '#120f1c');
  await p.click('#themePicker .swatch[data-preset="teal"]');
  t.check('a swatch clicked while the panel is open updates the panel', (await p.inputValue('#cp-bg-hex')) === '#0b1718' && (await p.inputValue('#cpPreset')) === 'teal');
  // typing a colour must not apply half-typed shorthand
  await p.selectOption('#cpPreset', 'blue');
  await p.fill('#cp-accent-hex', ''); await p.type('#cp-accent-hex', '#fff', { delay: 10 });
  t.check('a half-typed "#fff" is not applied while typing', (await css(p, '--accent')) === '#4d9fe8');
  await p.press('#cp-accent-hex', 'Enter'); await settle(p);
  t.check('…but shorthand is accepted on Enter (#fff → #ffffff)', (await css(p, '--accent')) === '#ffffff');
  for (const bad of ['zzzzzz', 'red', '#12', 'javascript:1', '#ffffgg', '<b>']) {
    await p.selectOption('#cpPreset', 'blue'); await p.fill('#cp-accent-hex', bad); await settle(p);
    const ok = (await css(p, '--accent')) === '#4d9fe8' && (await p.getAttribute('#cp-accent-hex', 'aria-invalid')) === 'true';
    await p.press('#cp-accent-hex', 'Tab');
    t.check(`an invalid colour (${JSON.stringify(bad)}) is flagged and ignored, and the box is restored on leaving`, ok && (await p.inputValue('#cp-accent-hex')) === '#4d9fe8');
  }
  // the hex box holds at most 7 characters, so a pasted injection string is cut to something harmless
  await p.selectOption('#cpPreset', 'blue'); await p.fill('#cp-accent-hex', '#ffffff;background:url(https://evil.test/x)'); await settle(p);
  const rootAfter = await p.evaluate(() => document.documentElement.getAttribute('style') || '');
  t.check('a pasted colour with extra CSS after it is cut to 7 characters, so nothing extra can reach the page', (await p.inputValue('#cp-accent-hex')).length <= 7 && !/url\(|evil|;background/.test(rootAfter), rootAfter.slice(0, 100));
  t.check('no uncaught errors while editing colours', p.errs.length === 0, p.errs.join(' | '));
  await p.ctx.close();

  /* ---------------- readability rules ---------------- */
  t.scope('appearance › readability');
  p = await open(browser, base, { panel: true });
  await hex(p, 'text', '#0d1420'); await settle(p);            // text identical to the background
  t.check('unreadable text (same as the background) is refused: the page keeps its colours', (await css(p, '--text')) === '#dbe6f2');
  t.check('…and the panel explains which pair is too low, in a visible alert', /Not applied yet/.test(await p.textContent(`${P} .cp-alert[role="alert"]`)) && await p.isVisible(`${P} .cp-alert[role="alert"]`));
  t.check('…and the readability list marks it "Too low"', /Too low/.test(await p.textContent('.cp-contrast')));
  t.check('…and nothing unreadable was saved', (await stored(p, 'appearance')) === null || (await stored(p, 'appearance')).colours.text === '#dbe6f2');
  await hex(p, 'text', '#ffffff'); await settle(p);
  t.check('fixing it applies the colours automatically and clears the alert', (await css(p, '--text')) === '#ffffff' && !(await p.isVisible(`${P} .cp-alert[role="alert"]`)));
  await p.ctx.close();

  p = await open(browser, base, { panel: true });   // dark look -> light look, one colour at a time
  const LIGHT = [['bg', '#ffffff'], ['panel', '#f2f4f8'], ['panel2', '#e6eaf0'], ['border', '#b8c2d0'], ['text', '#111111'], ['dim', '#4a5568'], ['accent', '#0b4fb3'], ['win', '#1b6e2a'], ['loss', '#a31d1d']];
  let sawPending = false;
  for (const [role, v] of LIGHT) { await hex(p, role, v); if (await p.isVisible(`${P} .cp-alert[role="alert"]`)) sawPending = true; }
  await settle(p);
  t.check('turning a dark look into a light one works one colour at a time (unreadable steps wait, not block you)', sawPending && (await css(p, '--bg')) === '#ffffff' && (await css(p, '--text')) === '#111111' && !(await p.isVisible(`${P} .cp-alert[role="alert"]`)), `pending=${sawPending} bg=${await css(p, '--bg')} text=${await css(p, '--text')}`);
  t.check('…and the result is saved', (await stored(p, 'appearance')).colours.bg === '#ffffff');
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  await hex(p, 'dim', '#607286'); await settle(p);            // between 3:1 and 4.5:1 against the surfaces it sits on
  const weakInfo = await p.evaluate(() => evaluateColours(appearance.colours).weak.length);
  t.check('weak (3–4.5:1) colours are applied, with a warning note but no block', (await css(p, '--dim')) === '#607286' && weakInfo > 0 && /weak/i.test(await p.textContent('.cp-contrast')) && !(await p.isVisible(`${P} .cp-alert[role="alert"]`)), await p.textContent('.cp-contrast'));
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  await hex(p, 'text', '#0d1420'); await p.click('#cpClose'); await p.waitForTimeout(200);
  await p.click('#colourBtn');
  t.check('closing the panel drops an unapplied unreadable draft (boxes match the page again)', (await p.inputValue('#cp-text-hex')) === '#dbe6f2');
  await p.ctx.close();

  /* ---------------- fonts and sizes ---------------- */
  t.scope('appearance › font style and text size');
  p = await open(browser, base, { panel: true });
  const fontOf = () => p.evaluate(() => getComputedStyle(document.body).fontFamily);
  t.check('the default font is monospace (as before)', /SF Mono|Consolas|Menlo|monospace/.test(await fontOf()));
  await p.check(`${P} input[name="cp-Font style"][value="sans"]`); await settle(p);
  t.check('Sans-serif applies to the page', /system-ui|Segoe UI|Helvetica/.test(await fontOf()) && !/monospace/.test(await fontOf()));
  await p.check(`${P} input[name="cp-Font style"][value="serif"]`); await settle(p);
  t.check('Serif applies to the page', /Georgia/.test(await fontOf()));
  t.check('buttons and inputs use the chosen font too', await p.evaluate(() => getComputedStyle(document.getElementById('analyzeBtn')).fontFamily === getComputedStyle(document.body).fontFamily));
  await p.reload(); t.check('the font style is remembered', /Georgia/.test(await fontOf()));
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  const sizeOf = sel => p.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), sel);
  t.check('at Medium the text is exactly its original size (12.5px subtitle)', (await sizeOf('.brief p')) === 12.5 && (await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))) === 16);
  await p.check(`${P} input[name="cp-Text size"][value="small"]`); await settle(p);
  t.check('Small makes text 10% smaller everywhere', Math.abs((await sizeOf('.brief p')) - 11.25) < 0.01 && Math.abs((await sizeOf('#analyzeBtn')) - 11.7) < 0.01, (await sizeOf('.brief p')) + ' / ' + (await sizeOf('#analyzeBtn')));
  await p.check(`${P} input[name="cp-Text size"][value="large"]`); await settle(p);
  t.check('Large makes text 15% bigger everywhere', Math.abs((await sizeOf('.brief p')) - 14.375) < 0.01, String(await sizeOf('.brief p')));
  await p.reload(); t.check('the text size is remembered', Math.abs((await sizeOf('.brief p')) - 14.375) < 0.01);
  await p.ctx.close();

  /* ---------------- my presets ---------------- */
  t.scope('appearance › my presets');
  p = await open(browser, base, { panel: true });
  const save = async name => { await p.fill('#cpName', name); await p.click('#cpSave'); await p.waitForTimeout(80); return norm(await p.textContent('#cpNameMsg')); };
  await hex(p, 'accent', '#ffb000'); await settle(p);
  t.check('a Spanish name with accents and ñ is accepted', (await save('Azul Océano ñ')) === 'Saved.');
  t.check('"Niño ¡Hola!" (inverted punctuation) is accepted', (await save('Niño ¡Hola!')) === 'Saved.');
  t.check('a name typed with a decomposed accent is stored in its normal form', (await save('Café oscuro')) === 'Saved.' && (await p.$$eval('.cp-myname', n => n.map(x => x.textContent))).includes('Café oscuro'));
  const rejected = { 'Japanese letters': '日本語', 'HTML': '<img src=x onerror=1>', 'an emoji': '😀', 'nothing': '', 'too long (31)': 'x'.repeat(31), 'a direction-override character': 'A‮b', 'a duplicate (any case)': 'azul océano Ñ' };
  for (const [why, name] of Object.entries(rejected)) {
    const before = (await stored(p, 'myPresets')).length, msg = await save(name);
    t.check(`a name with ${why} is refused with a message`, msg.length > 0 && msg !== 'Saved.' && (await stored(p, 'myPresets')).length === before, msg);
  }
  t.check('saved presets appear in the preset list under "My presets"', JSON.stringify(await p.$$eval('#cpPreset optgroup[label="My presets"] option', o => o.map(x => x.textContent))) === JSON.stringify(['Azul Océano ñ', 'Niño ¡Hola!', 'Café oscuro']));
  t.check('the new preset is now the base ("Matches …")', /Matches “Café oscuro”/.test(await p.textContent('#cpModified')));
  await p.check('#cpAnyChars');
  t.check('“Allow other characters” then accepts Japanese letters', (await save('日本語')) === 'Saved.');
  t.check('…but never control or direction-changing characters', (await save('A‮b')).length > 0 && (await stored(p, 'myPresets')).length === 4);
  await p.uncheck('#cpAnyChars');
  await settle(p);
  await p.reload(); await p.click('#colourBtn'); await p.waitForSelector(P + ':not([hidden])');
  t.check('saved presets survive a reload, still selected as the base', (await p.$$('.cp-myrow')).length === 4 && /Matches “日本語”/.test(await p.textContent('#cpModified')));
  // use / rename / delete
  await p.selectOption('#cpPreset', 'blue'); await settle(p);
  await p.click('.cp-myrow:has-text("Niño") >> text=Use'); await settle(p);
  t.check('"Use" applies a saved preset', (await css(p, '--accent')) === '#ffb000' && /Niño ¡Hola!/.test(await p.textContent('#cpModified')));
  await p.click('.cp-myrow:has-text("Niño") >> text=Rename'); await p.fill('.cp-myrow input[type=text]', 'Naranja'); await p.click('.cp-myrow >> text=Save');
  t.check('renaming works', (await p.$$eval('.cp-myname', n => n.map(x => x.textContent))).includes('Naranja'));
  await p.click('.cp-myrow:has-text("Naranja") >> text=Rename'); await p.fill('.cp-myrow input[type=text]', '<b>x</b>'); await p.click('.cp-myrow >> text=Save');
  t.check('renaming to a disallowed name is refused with a message', /Use English or Spanish/.test(await p.textContent('.cp-myrow:has(input[type=text])')), norm(await p.textContent('.cp-myrow:has(input[type=text])')));
  await p.click('.cp-myrow >> text=Cancel');
  await p.click('.cp-myrow:has-text("Naranja") >> text=Delete');
  t.check('delete asks for a second click first (nothing deleted yet)', (await stored(p, 'myPresets')).length === 4);
  await p.click('.cp-myrow:has-text("Naranja") >> text=Sure?'); await settle(p);
  t.check('…the second click deletes it', (await stored(p, 'myPresets')).length === 3 && !(await p.$$eval('.cp-myname', n => n.map(x => x.textContent))).includes('Naranja'));
  t.check('deleting the active preset keeps the colours and shows them as custom', (await css(p, '--accent')) === '#ffb000' && /Custom colours/.test(await p.textContent('#cpModified')));
  t.check('no uncaught errors while managing presets', p.errs.length === 0, p.errs.join(' | '));
  await p.ctx.close();

  // limits
  p = await open(browser, base, { panel: true });
  await p.evaluate(() => { for (let i = 1; i <= 20; i++) saveCurrentAsPreset('Preset ' + i); });
  await p.fill('#cpName', 'One too many'); await p.click('#cpSave');
  t.check('the 21st preset is refused: the normal limit is 20', /limit is 20/.test(await p.textContent('#cpNameMsg')) && (await stored(p, 'myPresets')).length === 20, await p.textContent('#cpNameMsg'));
  await p.check('#cpUnlock');
  t.check('ticking "allow more" shows the risk warning and changes nothing yet', await p.isVisible(`${P} .cp-alert:not([role="alert"])`) && (await p.evaluate(() => presetLimit())) === 20);
  await p.click('text=Cancel >> nth=0');
  t.check('cancelling keeps the limit at 20', (await p.evaluate(() => presetLimit())) === 20 && !(await p.isChecked('#cpUnlock')));
  await p.check('#cpUnlock'); await p.click('text=Yes, allow up to 100'); await settle(p);
  t.check('accepting the risk raises the limit to 100 and remembers it', (await p.evaluate(() => presetLimit())) === 100 && (await stored(p, 'presetLimitUnlocked')) === true);
  await p.fill('#cpName', 'Number 21'); await p.click('#cpSave');
  t.check('a 21st preset can now be saved', (await stored(p, 'myPresets')).length === 21);
  await p.evaluate(() => { for (let i = 22; i <= 100; i++) saveCurrentAsPreset('Preset ' + i + 'b'); });
  await p.fill('#cpName', 'Number 101'); await p.click('#cpSave');
  t.check('even unlocked, 100 is the ceiling', /limit is 100/.test(await p.textContent('#cpNameMsg')) && (await stored(p, 'myPresets')).length === 100, await p.textContent('#cpNameMsg'));
  t.check('no uncaught errors with 100 presets', p.errs.length === 0, p.errs.join(' | '));
  await p.ctx.close();

  /* ---------------- export and import of presets ---------------- */
  t.scope('appearance › preset files');
  p = await open(browser, base, { panel: true });
  await p.evaluate(() => { tryApplyColours({ ...appearance.colours, accent: '#ffb000' }); saveCurrentAsPreset('Mi tema'); tryApplyColours({ ...appearance.colours, accent: '#22cc88' }); saveCurrentAsPreset('Second'); });
  const exp = await dl(p, '#cpExport');
  const expJson = JSON.parse(exp.text);
  t.check('the export is a wt-colour-presets file with both presets and valid colours', expJson.format === 'wt-colour-presets' && expJson.presets.length === 2 && expJson.presets.every(x => Object.values(x.colours).every(v => /^#[0-9a-f]{6}$/.test(v))) && /^wt-colour-presets-\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.json$/.test(exp.name), exp.name);
  await p.ctx.close();
  p = await open(browser, base, { panel: true });
  await p.setInputFiles(fileInput, { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(exp.text) }); await p.waitForTimeout(200);
  t.check('importing that file into a fresh browser restores both presets', (await stored(p, 'myPresets')).length === 2 && /Imported 2 presets/.test(await p.textContent('#cpFileMsg')));
  await p.setInputFiles(fileInput, { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(exp.text) }); await p.waitForTimeout(200);
  t.check('importing it again adds copies with " 2" appended, never overwriting', (await p.$$eval('.cp-myname', n => n.map(x => x.textContent))).includes('Mi tema 2'));
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  const good = { name: 'Good', colours: { bg: '#101010', panel: '#1a1a1a', panel2: '#232323', border: '#555555', text: '#ffffff', dim: '#b0b8c4', accent: '#ffb000', win: '#66dd66', loss: '#ff7a7a' } };
  const hostile = { format: 'wt-colour-presets', version: 1, presets: [
    good,
    { name: 'Bad hex', colours: { ...good.colours, bg: 'red' } },
    { name: 'CSS injection', colours: { ...good.colours, bg: '#ffffff;background:url(https://evil.test/x)' } },
    { name: 'Missing role', colours: { bg: '#000000' } },
    { name: 'Not an object colours', colours: 'x' },
    { name: 'Unreadable', colours: { ...good.colours, text: '#101010' } },
    { name: '<img src=x onerror="window.__pwn=1">', colours: good.colours },
    { name: '日本語', colours: good.colours },
    null, 5, 'x',
    { name: 'Also good', id: 'my:../../evil', colours: good.colours }
  ] };
  await p.setInputFiles(fileInput, { name: 'h.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(hostile)) }); await p.waitForTimeout(250);
  const names = await p.$$eval('.cp-myname', n => n.map(x => x.textContent));
  t.check('a hostile preset file imports only the two valid presets', names.join() === 'Good,Also good', names.join());
  const rootStyle = await p.evaluate(() => document.documentElement.getAttribute('style') || '');
  t.check('no colour from the file reached the page’s styles', !/url\(|evil|javascript|<|;background/.test(rootStyle) && (await css(p, '--bg')) === '#0d1420', rootStyle.slice(0, 120));
  t.check('the file’s own ids are ignored (ids are generated here)', (await stored(p, 'myPresets')).every(x => /^[a-f0-9]{16}$/.test(x.id)));
  t.check('the import message says what was skipped and why', /skipped/.test(await p.textContent('#cpFileMsg')));
  t.check('nothing executed', (await p.evaluate(() => window.__pwn || 0)) === 0 && p.errs.length === 0, p.errs.join(' | '));
  for (const [why, buf] of [['not JSON', Buffer.from('{oops')], ['a different JSON format', Buffer.from('{"format":"other","presets":[]}')], ['a file over 1 MB', Buffer.alloc(1100 * 1024, 0x20)]]) {
    await p.setInputFiles(fileInput, { name: 'x.json', mimeType: 'application/json', buffer: buf }); await p.waitForTimeout(150);
    t.check(`${why} is rejected politely`, (await p.textContent('#cpFileMsg')).length > 5 && p.errs.length === 0 && (await stored(p, 'myPresets')).length === 2);
  }
  await p.ctx.close();

  /* ---------------- tampered storage ---------------- */
  t.scope('appearance › tampered settings');
  for (const [why, data] of Object.entries({
    'garbage types': { appearance: 'nope', myPresets: { a: 1 }, presetLimitUnlocked: 'yes', allowAnyNameChars: 5 },
    'hostile colours': { appearance: { v: 1, presetId: '<script>', colours: { bg: 'red', panel: 'url(x)', panel2: '#fff', border: '#fff', accent: '#fff', text: '#fff', dim: '#fff', win: '#fff', loss: '#fff' }, font: '<b>', size: 'huge' } },
    'extra keys and a hostile preset id': { appearance: { v: 1, presetId: 'my:../../x', colours: { ...presets[4].colours, evil: 'url(x)' }, font: 'serif', size: 'large' }, myPresets: [{ id: '../x', name: '<b>', colours: presets[0].colours }, { id: 'ok-1', name: 'Fine', colours: presets[1].colours }, { id: 'ok-1', name: 'Dup id', colours: presets[2].colours }] }
  })) {
    p = await open(browser, base, { init: { fn: d => Object.entries(d).forEach(([k, v]) => localStorage.setItem('wtSessionReadout.' + k, JSON.stringify(v))), arg: data }, panel: true });
    const ok = p.errs.length === 0;
    t.check(`${why}: the page and panel still load with no uncaught error`, ok, p.errs.join(' | '));
    const root = await p.evaluate(() => document.documentElement.getAttribute('style') || '');
    t.check(`${why}: only valid colours reach the page`, !/url\(|red|<|evil/.test(root) && /^#[0-9a-f]{6}$/.test(await css(p, '--bg')), root.slice(0, 100));
    if (why === 'extra keys and a hostile preset id') {
      t.check(`${why}: bad saved presets are dropped, good ones kept once`, JSON.stringify(await p.$$eval('.cp-myname', n => n.map(x => x.textContent))) === JSON.stringify(['Fine']));
      t.check(`${why}: valid parts of saved settings still apply (Crimson colours, serif, large)`, (await css(p, '--bg')) === '#170e10' && /Georgia/.test(await p.evaluate(() => getComputedStyle(document.body).fontFamily)));
    } else t.check(`${why}: falls back to the defaults (Blue, monospace, medium)`, (await css(p, '--bg')) === '#0d1420' && (await css(p, '--text-scale')) === '1');
    await p.ctx.close();
  }

  /* ---------------- reports and both views ---------------- */
  t.scope('appearance › reports and views');
  p = await open(browser, base, { panel: true });
  await p.click('#loadExampleBtn'); await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
  await hex(p, 'accent', '#ffb000'); await hex(p, 'win', '#33dd66'); await settle(p);
  const rep = await dl(p, '#exportBtn');
  t.check('an exported report is styled with the colours you chose (all nine, incl. win and loss)', /--accent: #ffb000/.test(rep.text) && /--win: #33dd66/.test(rep.text) && /--bg: #0d1420/.test(rep.text));
  const q = await newPage(browser); await q.setContent(rep.text); await q.waitForTimeout(300);
  t.check('opened, the report shows those colours', await q.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) === '#ffb000');
  t.check('its own picker offers the eight presets plus "Your colours"', (await q.$$('#themePicker .swatch')).length === 9 && (await q.$$eval('#themePicker .swatch', s => s.map(x => x.title))).includes('Your colours'));
  await q.click('#themePicker .swatch[title="Daylight"]');
  t.check('picking Daylight inside the report switches every colour, win and loss included', await q.evaluate(() => { const s = getComputedStyle(document.documentElement); return s.getPropertyValue('--bg').trim() === '#f4f6f9' && s.getPropertyValue('--win').trim() === '#2b7a33' && s.getPropertyValue('--loss').trim() === '#b3261e'; }));
  t.check('the report still runs under its own strict policy (its script ran)', /Content-Security-Policy/.test(rep.text) && /nonce-/.test(rep.text) && q.errs.length === 0 && q.consoleErrs.length === 0, q.consoleErrs.join(' | '));
  await q.ctx.close();
  await p.click('#themePicker .swatch[data-preset="forest"]'); await settle(p);
  const rep2 = await dl(p, '#exportBtn');
  t.check('an untouched preset exports with just its eight siblings (no "Your colours")', /--bg: #0f1712/.test(rep2.text) && !/Your colours/.test(rep2.text));
  t.snapshot('report data sections are identical whatever the colours (tables only)', rep2.text.slice(rep2.text.indexOf('<body>'), rep2.text.indexOf('<script')).replace(/Generated [^<]+/, 'Generated X'));
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  await p.selectOption('#cpPreset', 'crimson'); await hex(p, 'accent', '#ffb000'); await settle(p);
  await p.goto(base + 'advanced.html'); await p.waitForTimeout(300);
  t.check('the Advanced view shows the same look you set in Basic', (await css(p, '--bg')) === '#170e10' && (await css(p, '--accent')) === '#ffb000');
  await p.click('#colourBtn'); await p.waitForSelector(P + ':not([hidden])');
  t.check('the Advanced view has the same panel, showing the same state', (await p.inputValue('#cp-accent-hex')) === '#ffb000' && (await p.inputValue('#cpPreset')) === 'crimson');
  await p.click('#cpResetAll'); await settle(p);
  t.check('"Reset everything to default" restores Blue, monospace, medium text', (await css(p, '--bg')) === '#0d1420' && (await css(p, '--text-scale')) === '1' && /monospace/.test(await p.evaluate(() => getComputedStyle(document.body).fontFamily)));
  t.check('no uncaught errors across both views', p.errs.length === 0, p.errs.join(' | '));
  await p.ctx.close();

  /* ---------------- printing / Save as PDF ---------------- */
  t.scope('appearance › printing');
  p = await open(browser, base);
  await p.click('#themePicker .swatch[data-preset="forest"]'); await settle(p);
  const log = fs.readFileSync(require('path').join(__dirname, '..', '..', 'example data', 'matches.txt'), 'utf8');
  await p.evaluate(v => { document.getElementById('input').value = v + '\n' + v; }, log);   // the same log twice → every match is a duplicate once
  await p.click('#analyzeBtn'); await p.waitForTimeout(400);
  const onScreen = await p.$$eval('#matchTable tr', r => r.length), dupes = await p.$$eval('tr.dupe', r => r.length);
  t.check('on screen the repeated matches are listed (struck through), so there is something to leave out', dupes > 0 && onScreen > dupes, `${dupes} of ${onScreen}`);
  await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => { const g = (e, k) => getComputedStyle(e)[k]; const d = document.documentElement.style; return { bg: g(document.body, 'backgroundColor'), htmlBg: g(document.documentElement, 'backgroundColor'), text: g(document.querySelector('#matchTable td:nth-child(2)'), 'color'), adjust: g(document.documentElement, 'printColorAdjust'), dupe: g(document.querySelector('tr.dupe'), 'display'), win: g(document.querySelector('tr.win td.result'), 'color'), loss: g(document.querySelector('tr.loss td.result'), 'color'), panel: g(document.querySelector('.stat-cell'), 'backgroundColor'), controls: g(document.querySelector('.controls'), 'display'), area: g(document.getElementById('input'), 'display'), more: g(document.getElementById('matchTableMore'), 'display') }; });
  const forest = await p.evaluate(() => presetById('forest').colours), rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
  t.check('a printout keeps the chosen theme: page background is the preset\'s (not white)', pr.bg === rgb(forest.bg) && pr.htmlBg === rgb(forest.bg), JSON.stringify(pr));
  t.check('…with its text, panel, win and loss colours', pr.text === rgb(forest.text) && pr.panel === rgb(forest.panel) && pr.win === rgb(forest.win) && pr.loss === rgb(forest.loss), JSON.stringify(pr));
  t.check('…and the browser is told to keep those colours even with "background graphics" off (print-color-adjust: exact)', pr.adjust === 'exact');
  t.check('repeated (duplicate) matches are left out of the printout, like they are left out of every total', pr.dupe === 'none');
  t.check('buttons, the paste box and the "show more" row are not printed', pr.controls === 'none' && pr.area === 'none' && pr.more === 'none');
  const pdf = await p.pdf({ printBackground: false, format: 'A4' });                       // what "Save as PDF" does with default settings
  const streams = []; { const s = pdf.toString('latin1'), re = /stream\r?\n/g; let m; while ((m = re.exec(s))) { const en = s.indexOf('endstream', m.index + m[0].length); try { streams.push(require('zlib').inflateSync(Buffer.from(s.slice(m.index + m[0].length, en), 'latin1')).toString('latin1')); } catch (e) { /* not a content stream */ } } }
  const fillOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => +(v / 255).toFixed(4)).map(v => String(v).replace(/^0\./, '.')); };
  const has = h => { const [r, g, b] = fillOf(h); return streams.some(x => x.includes(`${r} ${g} ${b} rg`)); };
  t.check('a real PDF made with default print settings contains the theme\'s background and text colours', has(forest.bg) && has(forest.text), `${streams.length} streams`);
  const plainWin = await p.evaluate(() => { const r = document.querySelector('tr.win td.result'); return !!r; });
  t.check('a PDF is produced (and there is a win row to print)', pdf.length > 5000 && plainWin);
  await p.ctx.close();

  p = await open(browser, base, { panel: true });
  await hex(p, 'accent', '#ffb000'); await p.reload();       // reload immediately: the pending save must be flushed on the way out
  t.check('a colour changed a split second before leaving the page is still remembered', (await css(p, '--accent')) === '#ffb000');
  await p.ctx.close();
};
