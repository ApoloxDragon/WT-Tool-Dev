/* Site suite: stable and dev are different sites on ONE origin (github.io), told apart by the URL at runtime
 * (WT_DEV in appearance-core.js), never by the files — so merging Dev into main cannot change which is which.
 * Here both are opened in one browser context (one origin, exactly like production) via a URL rewrite that serves
 * /WT-Tool-Dev/... from the same files. Checks: storage is separate, the dev marker appears only on dev, the icons,
 * the logo link, the service-worker cache names, and that the static files carry nothing dev-specific. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { newPage, ROOT } = require('../harness');

const STABLE = 'WarThunder-Tool/', DEV = 'WT-Tool-Dev/';
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pngSize = rel => { const b = fs.readFileSync(path.join(ROOT, rel)); return b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };

// What the service worker will call its caches, when served from a given folder.
function cacheNames(scopeUrl) {
  const code = read('tools/sw.template.js').replace('__VERSION__', 'abc').replace('__PRECACHE__', '[]') + '\n;[PREFIX, SHELL, EXAMPLES];';
  return vm.runInNewContext(code, { self: { location: { href: scopeUrl + 'sw.js', origin: 'https://example.github.io' }, addEventListener() {}, clients: {}, skipWaiting() {} }, caches: {}, URL, fetch() {} });
}

exports.run = async ({ browser, base, t }) => {
  /* ---------- the files themselves ---------- */
  t.scope('site › static files');
  for (const page of ['wt-log-analyzer.html', 'advanced.html']) {
    const html = read(page);
    t.check(`${page}: no dev banner in the markup (the dev site adds it at runtime)`, !/dev-banner|Development build/.test(html));
    t.check(`${page}: the GitHub logo links to the stable repo in the markup (the dev site retargets it at runtime)`, /class="github-link" href="https:\/\/github\.com\/ApoloxDragon\/WarThunder-Tool"/.test(html));
    t.check(`${page}: a tab icon and a touch icon are declared`, /<link rel="icon" href="assets\/icon-64\.png"/.test(html) && /<link rel="apple-touch-icon" href="assets\/icon-180\.png"/.test(html));
  }
  t.check('the stylesheet carries no dev-banner rules (they ship inside dev-mode.js, which only the dev site loads)', !/\.dev-banner\s*\{/.test(read('css/styles.css')));
  t.check('the bundles do not contain the dev marker code', !/\[DEV\]/.test(read('dist/extras.js') + read('dist/app-basic.js') + read('dist/app-advanced.js')));
  for (const [file, size] of [['assets/icon-64.png', 64], ['assets/icon-dev-64.png', 64], ['assets/icon-180.png', 180], ['assets/icon-dev-180.png', 180]]) {
    const dims = pngSize(file);
    t.check(`${file} exists and is a ${size}×${size} PNG`, !!dims && dims[0] === size && dims[1] === size, JSON.stringify(dims));
  }
  t.check('both icon sources are SVG', /^<svg\b/.test(read('assets/icon.svg')) && /^<svg\b/.test(read('assets/icon-dev.svg')));

  /* ---------- service-worker cache names ---------- */
  t.scope('site › service worker caches');
  const stableCaches = cacheNames('https://example.github.io/WarThunder-Tool/'), devCaches = cacheNames('https://example.github.io/WT-Tool-Dev/');
  t.check('the stable site and the dev site use different cache names', stableCaches.every(n => !devCaches.includes(n)), JSON.stringify({ stableCaches, devCaches }));
  // What each service worker deletes as "my old versions": caches starting with <prefix>shell- (but not its current one).
  const pre = names => names[1].slice(0, names[1].indexOf('shell-'));   // names = [prefix, shell cache, examples cache]
  t.check('neither site\'s cleanup of old versions could match the other site\'s caches',
    !stableCaches[1].startsWith(pre(devCaches) + 'shell-') && !devCaches[1].startsWith(pre(stableCaches) + 'shell-'), JSON.stringify({ stableCaches, devCaches }));  t.check('a site served from the origin root counts as stable', cacheNames('https://example.github.io/')[1].startsWith('wt-tool-shell-'));

  /* ---------- both sites, one browser, one origin ---------- */
  const sA = await newPage(browser);                                   // stable, served at /WarThunder-Tool/
  const ctx = sA.ctx;
  await ctx.route(/\/(WarThunder-Tool|WT-Tool-Dev)\//, r => r.continue({ url: r.request().url().replace(/\/(WarThunder-Tool|WT-Tool-Dev)\//, '/') }));
  const open = async (folder, pageFile = 'wt-log-analyzer.html') => {
    const p = folder === STABLE && !open.used ? sA : await ctx.newPage();
    if (p === sA) open.used = true; else { p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept()); }
    await p.goto(base + folder + pageFile);
    await p.waitForSelector('#themePicker');
    return p;
  };
  const stable = await open(STABLE), dev = await open(DEV);
  await dev.waitForSelector('.dev-banner', { timeout: 5000 }).catch(() => {});
  const info = p => p.evaluate(() => ({
    dev: WT_DEV, store: WT_STORE, banner: !!document.querySelector('.dev-banner'), bannerLink: (document.querySelector('.dev-banner a') || {}).href || null,
    title: document.title, gh: document.querySelector('.github-link').href,
    icons: [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(l => l.getAttribute('href')),
    devScript: [...document.scripts].some(s => /dev-mode\.js/.test(s.src))
  }));
  const S = await info(stable), D = await info(dev);

  t.scope('site › which site is which');
  t.check('the /WarThunder-Tool/ page is stable', S.dev === false && S.store === 'wtSessionReadout');
  t.check('the /WT-Tool-Dev/ page is dev', D.dev === true && D.store === 'wtSessionReadoutDev');
  t.check('stable shows no banner, no [DEV] in the title and never loads the dev marker code', !S.banner && !/^\[DEV\]/.test(S.title) && !S.devScript);
  t.check('dev shows the banner (linking to the stable site), a [DEV] title and loads the marker code', D.banner && /WarThunder-Tool\/?$/.test(D.bannerLink) && /^\[DEV\] /.test(D.title) && D.devScript, JSON.stringify({ b: D.banner, l: D.bannerLink, t: D.title }));
  t.check('the GitHub logo points at the stable repo on stable and the dev repo on dev', /ApoloxDragon\/WarThunder-Tool$/.test(S.gh) && /ApoloxDragon\/WT-Tool-Dev$/.test(D.gh), `${S.gh} | ${D.gh}`);
  t.check('stable uses the normal icons; dev uses the dev (red-corner) icons', JSON.stringify(S.icons) === JSON.stringify(['assets/icon-64.png', 'assets/icon-180.png']) && JSON.stringify(D.icons) === JSON.stringify(['assets/icon-dev-64.png', 'assets/icon-dev-180.png']), JSON.stringify({ S: S.icons, D: D.icons }));
  const iconOk = await dev.evaluate(async () => (await Promise.all([...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(l => fetch(l.href).then(r => r.ok)))).every(Boolean));
  t.check('every icon the dev page points at really loads', iconOk);

  /* ---------- storage is separate ---------- */
  t.scope('site › storage');
  await stable.click('#loadExampleBtn');
  await stable.waitForFunction(() => /match/.test(document.getElementById('archiveNote').textContent));
  const stableCount = await stable.evaluate(async () => (await WtDB.ids()).length);
  await (await stable.$$('#themePicker .swatch')).at(-1).click();                    // a non-default look on stable
  await stable.waitForTimeout(400);
  t.check('stable now holds an archive, a saved session and a saved look', stableCount > 0);

  const devSees = () => dev.evaluate(async () => ({ ids: (await WtDB.ids()).length, saved: localStorage.getItem('wtSessionReadoutDev.inputText'), look: localStorage.getItem('wtSessionReadoutDev.appearance'), legacyKeys: Object.keys(localStorage).filter(k => k.startsWith('wtSessionReadout.')).length }));
  await dev.reload(); await dev.waitForSelector('#loadExampleBtn');
  const before = await devSees();
  t.check('the dev site starts empty: no archive, no saved session, no saved look', before.ids === 0 && before.saved === null && before.look === null, JSON.stringify(before));
  t.check('…and its page is not showing stable\'s results or look', !(await dev.isVisible('#results')) && (await dev.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== (await stable.evaluate(() => getComputedStyle(document.body).backgroundColor)));
  t.check('stable\'s data is under its original names, the dev site\'s under its own', await stable.evaluate(() => Object.keys(localStorage).every(k => !k.startsWith('wtSessionReadoutDev.'))) && before.legacyKeys > 0);

  await dev.click('#loadExampleBtn');
  await dev.waitForFunction(() => /match/.test(document.getElementById('archiveNote').textContent));
  const devCount = await dev.evaluate(async () => (await WtDB.ids()).length);
  const stableAfterDevWrites = await stable.evaluate(async () => (await WtDB.ids()).length);
  t.check('analysing on dev fills the dev archive and leaves stable\'s alone', devCount > 0 && stableAfterDevWrites === stableCount, JSON.stringify({ devCount, stableAfterDevWrites, stableCount }));
  const dbNames = await dev.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort());
  t.check('the two sites use two IndexedDB databases', dbNames.includes('wtSessionReadout-dev') && dbNames.includes('wtSessionReadoutDev'), JSON.stringify(dbNames));

  await dev.evaluate(async () => { await WtDB.clear(); });
  t.check('wiping the archive on dev does not touch stable\'s', (await stable.evaluate(async () => (await WtDB.ids()).length)) === stableCount);
  await dev.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('wtSessionReadoutDev.')).forEach(k => localStorage.removeItem(k)); });
  t.check('clearing the dev site\'s saved settings does not touch stable\'s', await stable.evaluate(() => localStorage.getItem('wtSessionReadout.appearance') !== null && localStorage.getItem('wtSessionReadout.inputText') !== null));

  /* ---------- the Advanced view follows the same rules ---------- */
  t.scope('site › advanced view');
  const advDev = await open(DEV, 'advanced.html'), advStable = await open(STABLE, 'advanced.html').catch(() => null);
  const aD = await info(advDev);
  t.check('the dev Advanced view is dev: banner, [DEV] title, dev repo link, dev icons, its own storage', aD.dev && aD.banner && /^\[DEV\] /.test(aD.title) && /WT-Tool-Dev$/.test(aD.gh) && aD.icons[0] === 'assets/icon-dev-64.png' && aD.store === 'wtSessionReadoutDev', JSON.stringify(aD));
  if (advStable) { const aS = await info(advStable); t.check('the stable Advanced view shows none of that', !aS.dev && !aS.banner && !/^\[DEV\]/.test(aS.title) && /WarThunder-Tool$/.test(aS.gh) && aS.icons[0] === 'assets/icon-64.png', JSON.stringify(aS)); }
  t.check('no uncaught errors on either site', sA.errs.length === 0 && dev.errs.length === 0 && advDev.errs.length === 0, sA.errs.concat(dev.errs, advDev.errs).join(' | '));
  await ctx.close();
};
