/* Offline suite: the service worker — installs, works with no network, updates safely, and can't hurt anything else.
 * (tools/sw.template.js → /sw.js, registered by javascript/sw-register.js.) Runs against a private copy of the site
 * so the update tests can change files and rebuild it. */
const fs = require('fs'), os = require('os'), path = require('path');
const { ROOT, newPage, startServer } = require('../harness');
const { build } = require('../../tools/build');

const ENABLE = { fn: () => localStorage.setItem('wtSessionReadout.enableServiceWorkerLocally', 'true') };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const swVersion = text => (text.match(/const VERSION = '([0-9a-f]+)'/) || [])[1];

function copySite() {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-site-'));
  for (const f of ['index.html', 'wt-log-analyzer.html', 'advanced.html', 'sw.js']) fs.copyFileSync(path.join(ROOT, f), path.join(dst, f));
  for (const d of ['css', 'assets', 'javascript', 'dist']) fs.cpSync(path.join(ROOT, d), path.join(dst, d), { recursive: true });
  fs.mkdirSync(path.join(dst, 'example data')); fs.copyFileSync(path.join(ROOT, 'example data', 'matches.txt'), path.join(dst, 'example data', 'matches.txt'));
  return dst;
}
const cacheNames = p => p.evaluate(() => caches.keys());
async function install(browser, base, extra = {}) {
  const p = await newPage(browser, { serviceWorkers: 'allow', init: ENABLE, ...extra });
  await p.goto(base + 'wt-log-analyzer.html');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
  return p;
}

exports.run = async ({ browser, t }) => {
  const site = copySite();
  const srv = await startServer({ gzip: true, cache: 600, etag: true, root: site });
  const base = srv.url;
  // Playwright's setOffline() does not reach requests made by the service worker, so the test server is taken down as well
  const goOffline = async (pg, off) => { srv.setDown(off); await pg.context().setOffline(off); };
  try {

  /* ---------- the worker file ---------- */
  t.scope('offline › the worker file');
  const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  t.check('it only touches GET requests, and only same-origin ones inside its own folder', /req\.method !== 'GET'\) return/.test(swText) && /url\.origin !== self\.location\.origin \|\| !url\.pathname\.startsWith\(SCOPE_PATH\)\) return/.test(swText));
  t.check('it can only delete caches carrying its own prefix', /startsWith\(PREFIX \+ 'shell-'\)/.test(swText) && !/caches\.delete\((?!SHELL|n\))/.test(swText));
  t.check('a new version never takes over by itself: skipWaiting() is only called when the page asks (the Reload button)', (swText.match(/self\.skipWaiting\(\)/g) || []).length === 1 && /event\.data === 'skipWaiting'\) self\.skipWaiting\(\)/.test(swText));
  t.check('what it caches is requested from the network, bypassing the HTTP cache (so no stale copy is frozen in)', /cache: 'reload'/.test(swText));
  const precache = JSON.parse(swText.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  t.check('everything the app needs offline is listed: pages, styles, logo, head scripts, the worker and its imports, all bundles', ['index.html', 'wt-log-analyzer.html', 'advanced.html', 'css/styles.css', 'assets/github-logo.png', 'javascript/load-guard.js', 'javascript/appearance-core.js', 'javascript/archive-worker.js', 'javascript/util.js', 'javascript/detail-parser.js'].every(f => precache.includes(f)) && ['app-basic', 'app-advanced', 'extras'].every(b => precache.some(u => u.startsWith(`dist/${b}.js?v=`))), precache.join(', '));
  t.check('every listed file exists', precache.every(u => fs.existsSync(path.join(ROOT, u.split('?')[0]))));

  /* ---------- install ---------- */
  t.scope('offline › first visit installs it');
  let p = await install(browser, base);
  const names = await cacheNames(p), ver = swVersion(swText);
  t.check('exactly one app cache exists, named for the version in sw.js', names.filter(n => n.startsWith('wt-tool-dev-shell-')).join() === 'wt-tool-dev-shell-' + ver, names.join());
  const cached = await p.evaluate(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname.replace(/^\//, '') + new URL(r.url).search), 'wt-tool-dev-shell-' + ver);
  t.check('the cache holds exactly the listed files', JSON.stringify([...cached].sort()) === JSON.stringify([...precache].sort()), cached.length + ' vs ' + precache.length);
  t.check('the very first page is already controlled (so offline works without a second visit)', await p.evaluate(() => !!navigator.serviceWorker.controller));
  await p.waitForTimeout(600);
  t.check('no "new version" note on a first install, and no errors', !(await p.$('.update-note')) && p.errs.length === 0 && p.consoleErrs.length === 0, p.errs.concat(p.consoleErrs).join(' | '));

  /* ---------- offline ---------- */
  t.scope('offline › with no network at all');
  await goOffline(p, true);
  await p.reload(); await p.waitForSelector('#analyzeBtn');
  t.check('the page loads offline, with its saved look and its Customise button (from the deferred bundle)', (await p.title()).includes('Session Readout') && !!(await p.$('#colourBtn')) && /^#/.test(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())));
  await p.evaluate(v => { document.getElementById('input').value = v; }, fs.readFileSync(path.join(ROOT, 'example data', 'matches.txt'), 'utf8'));
  await p.click('#analyzeBtn'); await p.waitForTimeout(500);
  t.check('Analyze works offline', /67/.test(await p.textContent('#overallStats')) && (await p.$$('#matchTable tr')).length === 85);
  await p.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent), null, { timeout: 8000 }).catch(() => {});
  t.check('…and the archive (compression worker included) works offline', /67 match/.test(await p.textContent('#archiveNote')));
  await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick');
  t.check('the Advanced view loads offline and lists the saved matches', (await p.$$('#libTable tr.pick')).length === 67);
  await p.evaluate(() => document.querySelectorAll('#insightsSection details').forEach(d => { d.open = true; }));
  await p.waitForFunction(() => document.querySelectorAll('#vehicleTable tr').length > 1, null, { timeout: 15000 });
  t.check('…and its insights', /KPz-70/.test(await p.textContent('#vehicleTable')));
  await p.goto(base);
  await p.waitForURL('**/wt-log-analyzer.html');
  t.check('the folder URL itself works offline (index.html → the app)', await p.isVisible('#analyzeBtn'));
  await p.goto(base + 'wt-log-analyzer.html?from=a-bookmark');
  t.check('a query string on the page URL does not break offline loading', await p.isVisible('#analyzeBtn'));
  await p.click('#loadExampleBtn'); await p.waitForTimeout(500);
  t.check('the example button offline (never fetched before) explains itself instead of failing silently', /Could not load example data/.test(await p.textContent('#importNote')));
  const unknown = await p.evaluate(() => fetch('not-part-of-the-app.txt').then(() => 'answered', () => 'failed cleanly'));
  t.check('something that was never cached just fails like any offline request', unknown === 'failed cleanly');
  await goOffline(p, false);
  await p.click('#loadExampleBtn'); await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
  await goOffline(p, true); await p.reload(); await p.waitForSelector('#loadExampleBtn');
  await p.click('#loadExampleBtn'); await p.waitForTimeout(600);
  t.check('once the example has been fetched, it also loads offline', /67/.test(await p.textContent('#overallStats').catch(() => '')) && !/Could not load/.test(await p.textContent('#importNote')));
  t.check('no uncaught errors offline', p.errs.length === 0, p.errs.join(' | '));
  srv.setDown(false);
  await p.ctx.close();

  /* ---------- speed on a bad connection ---------- */
  t.scope('offline › a return visit on a terrible connection');
  p = await install(browser, base);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1500, downloadThroughput: 100e3 / 8, uploadThroughput: 100e3 / 8 }); // the "awful 2G-like" profile
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  const t0 = Date.now();
  await p.goto(base + 'wt-log-analyzer.html'); await p.waitForFunction(() => window.__wtReady === true && !!document.getElementById('colourBtn'), null, { timeout: 60000 });
  const took = Date.now() - t0;
  t.metric('return visit on 100 kbit/s, 1.5 s latency, 20x slower CPU: until fully usable', took);
  t.check('…the whole app is usable within 3 seconds (it took ~24 s without the service worker)', took < 3000, took + ' ms');
  await p.ctx.close();

  /* ---------- updates ---------- */
  t.scope('offline › updates');
  p = await install(browser, base);
  await p.evaluate(() => caches.open('someone-elses-cache'));          // something that is not ours must survive every cleanup
  const v1 = swVersion(fs.readFileSync(path.join(site, 'sw.js'), 'utf8'));
  const bundleBefore = await p.evaluate(() => document.querySelector('script[src*="app-basic"]').getAttribute('src'));
  fs.appendFileSync(path.join(site, 'javascript', 'math.js'), '\n// a change that ships as a new version\n');
  const rebuilt = build({ root: site });
  const v2 = swVersion(fs.readFileSync(path.join(site, 'sw.js'), 'utf8'));
  t.check('changing a source and rebuilding gives a new service-worker version', v1 !== v2 && rebuilt.stale.includes('sw.js') && rebuilt.stale.includes('dist/app-basic.js'), `${v1} -> ${v2}`);
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await p.waitForSelector('.update-note', { timeout: 10000 });
  t.check('the running page is told a new version is ready (role=status, with Reload and Later)', (await p.getAttribute('.update-note', 'role')) === 'status' && /new version is ready/i.test(await p.textContent('.update-note')) && !!(await p.$('.update-note >> text=Reload')) && !!(await p.$('.update-note >> text=Later')));
  t.check('…while this page keeps running the old version (nothing changes under your feet)', (await p.evaluate(() => document.querySelector('script[src*="app-basic"]').getAttribute('src'))) === bundleBefore);
  const during = await cacheNames(p);
  t.check('the new version is installed alongside the old one, waiting', during.filter(n => n.startsWith('wt-tool-dev-shell-')).sort().join() === ['wt-tool-dev-shell-' + v1, 'wt-tool-dev-shell-' + v2].sort().join(), during.join());
  await p.click('.update-note >> text=Later');
  t.check('"Later" dismisses the note', !(await p.$('.update-note')));
  await p.reload(); await p.waitForSelector('.update-note', { timeout: 10000 });
  t.check('…and it is offered again on the next visit while the update is still waiting', !!(await p.$('.update-note')));
  const nav = p.waitForEvent('framenavigated');
  await p.click('.update-note >> text=Reload');
  await nav; await p.waitForSelector('#analyzeBtn');
  await p.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.includes('sw.js'));
  await p.waitForTimeout(800);
  const bundleAfter = await p.evaluate(() => document.querySelector('script[src*="app-basic"]').getAttribute('src'));
  t.check('Reload switches the page to the new version', bundleAfter !== bundleBefore && bundleAfter === build({ root: site, write: false }).files['wt-log-analyzer.html'].match(/src="(dist\/app-basic\.js\?v=[0-9a-f]+)"/)[1]);
  const after = await cacheNames(p);
  t.check('the old version\'s cache is deleted, the new one kept', after.filter(n => n.startsWith('wt-tool-dev-shell-')).join() === 'wt-tool-dev-shell-' + v2, after.join());
  t.check('a cache that is not ours was never touched', after.includes('someone-elses-cache'));
  t.check('the updated app still works offline', await (async () => { await goOffline(p, true); await p.reload(); await p.waitForSelector('#analyzeBtn'); const ok = await p.isVisible('#analyzeBtn'); await goOffline(p, false); return ok; })());
  t.check('no uncaught errors through the whole update', p.errs.length === 0, p.errs.join(' | '));
  await p.ctx.close();

  /* ---------- safety ---------- */
  t.scope('offline › it stays out of the way');
  p = await newPage(browser, { serviceWorkers: 'allow' });                    // no "enable locally" flag
  await p.goto(base + 'wt-log-analyzer.html'); await p.waitForTimeout(1500);
  t.check('on localhost it is OFF by default, so edits are never hidden behind a cache', (await p.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))) === 0);
  await p.evaluate(() => localStorage.setItem('wtSessionReadout.enableServiceWorkerLocally', 'true'));
  await p.reload(); await p.evaluate(() => navigator.serviceWorker.ready);
  t.check('…and a flag turns it on', (await p.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))) === 1);
  await p.evaluate(() => localStorage.removeItem('wtSessionReadout.enableServiceWorkerLocally'));
  await p.reload(); await p.waitForTimeout(1500);
  t.check('…and turning the flag off again removes the worker', (await p.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))) === 0);
  await p.ctx.close();

  // A copy of the site where one file the worker lists is missing (service-worker requests can't be intercepted by the test
  // browser, so the file is genuinely absent from this copy's server). The pages themselves don't need that file — it is bundled.
  const broken = copySite(); fs.rmSync(path.join(broken, 'javascript', 'detail-parser.js'));
  const srv2 = await startServer({ gzip: true, cache: 600, etag: true, root: broken });
  try {
    p = await newPage(browser, { serviceWorkers: 'allow', init: ENABLE });
    await p.goto(srv2.url + 'wt-log-analyzer.html'); await p.waitForTimeout(3000);
    t.check('if caching the app fails, the worker never takes over and the site keeps working from the network', (await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !r || !r.active))) && await p.isVisible('#analyzeBtn'));
    t.check('…and no half-filled cache is left behind', (await cacheNames(p)).filter(n => n.startsWith('wt-tool-dev-shell-')).length === 0);
    t.check('…and nothing is reported as an uncaught error', p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();
  } finally { srv2.close(); fs.rmSync(broken, { recursive: true, force: true }); }

  } finally { srv.close(); fs.rmSync(site, { recursive: true, force: true }); }
};
