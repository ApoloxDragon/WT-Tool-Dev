/* Load suite: a saved look must be in place BEFORE the page first paints — no flash of the default Blue.
 * The page's main script (dist/app-*.js, which used to be the thing that applied the look) is slowed down on purpose, the way a phone or a
 * slow connection would, so a look applied only by that script shows up as a flash of the default.
 * What counts as "in place": the colours in effect when <body> first appears, and on every animation frame after. */
const { newPage } = require('../harness');

const BLUE = '#0d1420';
const rgbOf = hex => 'rgb(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
const CRIMSON = { bg: '#170e10', panel: '#211519', panel2: '#2b1b20', border: '#4a2a32', accent: '#ec6a80', text: '#f3e3e6', dim: '#b58b93', win: '#86c98d', loss: '#f0906c' };
const DAYLIGHT = { bg: '#f4f6f9', panel: '#ffffff', panel2: '#e8edf3', border: '#c4cdd9', accent: '#ff8800', text: '#1b2430', dim: '#556171', win: '#2b7a33', loss: '#b3261e' };

// Runs in the page before any of its own scripts: remembers the look at the moment <body> appears and on every frame.
function probe({ storage }) {
  Object.entries(storage).forEach(([k, v]) => localStorage.setItem('wtSessionReadout.' + k, JSON.stringify(v)));
  localStorage.setItem('wtSessionReadout.tutorialSeen.basic', 'true');
  localStorage.setItem('wtSessionReadout.tutorialSeen.advanced', 'true');
  window.__flash = { atBody: null, frames: [] };
  const read = () => {
    const root = document.documentElement;
    if (!root) return null;
    const s = getComputedStyle(root);
    return { bg: s.getPropertyValue('--bg').trim(), scale: s.getPropertyValue('--text-scale').trim(), font: s.getPropertyValue('--font').trim(),
      scheme: root.style.colorScheme, bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null };
  };
  new MutationObserver((m, obs) => { if (document.body) { window.__flash.atBody = read(); obs.disconnect(); } }).observe(document, { childList: true, subtree: true });
  const loop = () => { const r = read(); if (r) window.__flash.frames.push(r); if (window.__flash.frames.length < 300) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

async function load(browser, base, view, storage, slowMs = 700) {
  const p = await newPage(browser, { init: { fn: probe, arg: { storage } } });
  p.heldBack = 0;
  await p.route('**/dist/app-*.js*', async route => { p.heldBack++; await new Promise(r => setTimeout(r, slowMs)); route.continue(); }); // the page's main script arrives late
  await p.goto(base + view, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const flash = await p.evaluate(() => window.__flash);
  return { p, flash };
}

exports.run = async ({ browser, base, t }) => {
  const looks = {
    'a built-in preset (Crimson)': { storage: { appearance: { v: 1, presetId: 'crimson', colours: CRIMSON, font: 'mono', size: 'medium' } }, bg: CRIMSON.bg, scale: '1' },
    'custom colours + serif + large text (light)': { storage: { appearance: { v: 1, presetId: 'daylight', colours: DAYLIGHT, font: 'serif', size: 'large' } }, bg: DAYLIGHT.bg, scale: '1.15', font: 'Georgia', scheme: 'light' },
    'an old-style saved "theme" only (Forest)': { storage: { theme: 'forest' }, bg: '#0f1712', scale: '1' }
  };

  for (const view of ['wt-log-analyzer.html', 'advanced.html']) {
    for (const [name, look] of Object.entries(looks)) {
      t.scope(`load › ${view.startsWith('adv') ? 'Advanced' : 'Basic'} › ${name}`);
      const { p, flash } = await load(browser, base, view, look.storage);
      const f = flash.frames;
      t.check('(setup) the page\'s main script really was held back, so this test means something', p.heldBack === 1, String(p.heldBack));
      t.check('the saved colours are already in place the moment the page body appears', flash.atBody && flash.atBody.bg === look.bg, JSON.stringify(flash.atBody && flash.atBody.bg));
      t.check(`and on every one of the ${f.length} frames that follow (none shows the default Blue or an unstyled page)`, f.length > 5 && f.every(x => x.bg === look.bg), 'colours seen: ' + [...new Set(f.map(x => x.bg || '(none)'))].join(', '));
      t.check('the painted page background is that colour on every frame — no fade from Blue', f.filter(x => x.bodyBg).length > 3 && f.filter(x => x.bodyBg).every(x => x.bodyBg === rgbOf(look.bg)), 'backgrounds seen: ' + [...new Set(f.map(x => x.bodyBg))].join(' | '));
      t.check('text size is in place from the start', flash.atBody && flash.atBody.scale === look.scale && f.every(x => x.scale === look.scale), JSON.stringify(flash.atBody && flash.atBody.scale));
      if (look.font) t.check('the font style is in place from the start', flash.atBody && flash.atBody.font.startsWith(look.font), flash.atBody && flash.atBody.font);
      if (look.scheme) t.check('native controls and scrollbars already match a light look', flash.atBody && flash.atBody.scheme === look.scheme && f.every(x => x.scheme === look.scheme));
      t.check('and it is still that look after everything has loaded', (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())) === look.bg);
      t.check('no uncaught errors or console errors while loading', p.errs.length === 0 && p.consoleErrs.length === 0, p.errs.concat(p.consoleErrs).join(' | '));
      await p.ctx.close();
    }
    t.scope(`load › ${view.startsWith('adv') ? 'Advanced' : 'Basic'} › nothing saved`);
    const { p, flash } = await load(browser, base, view, {});
    t.check('with nothing saved, the default Blue look is used throughout and never anything else', flash.frames.length > 5 && flash.frames.every(x => x.bg === BLUE || x.bg === ''), [...new Set(flash.frames.map(x => x.bg))].join(', '));
    t.check('…and no errors', p.errs.length === 0 && p.consoleErrs.length === 0, p.errs.concat(p.consoleErrs).join(' | '));
    await p.ctx.close();
  }

  // the little redirect page that GitHub Pages' root URL shows for a moment
  t.scope('load › redirect page (index.html)');
  const p = await newPage(browser, { init: { fn: probe, arg: { storage: { appearance: { v: 1, presetId: 'crimson', colours: CRIMSON, font: 'mono', size: 'medium' } } } } });
  // Keep the redirect page on screen: stretch its "refresh in 0 seconds" so it doesn't navigate away mid-check.
  await p.route('**/index.html', async route => {
    const resp = await route.fetch();
    await route.fulfill({ response: resp, body: (await resp.text()).replace('content="0;', 'content="600;') });
  });
  await p.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  const idx = await p.evaluate(() => ({ url: location.pathname, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), page: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color, flash: window.__flash.atBody }));
  t.check('the redirect page is still on screen for this check', /index\.html$/.test(idx.url), idx.url);
  t.check('the redirect page already uses the saved colours (not a plain white page)', idx.flash && idx.flash.bg === CRIMSON.bg && idx.page === rgbOf(CRIMSON.bg), JSON.stringify([idx.flash && idx.flash.bg, idx.page]));
  t.check('…and its text is readable on that background', idx.text !== idx.page && idx.text !== 'rgb(0, 0, 0)', idx.text);
  await p.ctx.close();
};
