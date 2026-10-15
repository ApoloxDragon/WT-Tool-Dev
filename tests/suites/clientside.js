/* Client-side-only suite: the project rule that NOTHING leaves the user's device. See AGENTS.md / CONTRIBUTING.md.
 *   - runtime: every request, fetch, beacon, socket and image made while really using both views is same-origin
 *   - static: no source file can reach another origin, use powerful browser APIs, or run strings as code
 *   - policy: every shipped page (and the exported report) carries a restrictive Content-Security-Policy
 * The GitHub link in the top bar is an ordinary link the user clicks; it is the only external address in the pages. */
const fs = require('fs'), path = require('path');
const { ROOT, newPage } = require('../harness');

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ALLOWED_LINKS = [/^https:\/\/github\.com\/ApoloxDragon\//, /^https:\/\/apoloxdragon\.github\.io\//];
// The documentation page may also link to the public references it cites (links only — it loads nothing).
const DOC_LINKS = [/^https:\/\/cheatsheetseries\.owasp\.org\//, /^https:\/\/github\.blog\//];
const PAGES = ['index.html', 'wt-log-analyzer.html', 'advanced.html', 'docs/index.html'];

// Runs before any page script: records everything that could talk to the network.
function spy() {
  const calls = window.__net = [];
  const note = (kind, u) => { try { calls.push(kind + ' ' + new URL(String(u), location.href).href); } catch (e) { calls.push(kind + ' ' + String(u)); } };
  const f = window.fetch; window.fetch = function (r) { note('fetch', r && r.url ? r.url : r); return f.apply(this, arguments); };
  const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { note('xhr', u); return o.apply(this, arguments); };
  if (navigator.sendBeacon) { const b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, d) => { note('beacon', u); return b(u, d); }; }
  for (const k of ['WebSocket', 'EventSource']) { const C = window[k]; if (C) window[k] = function (u) { note(k, u); return new C(...arguments); }; }
  const W = window.Worker; window.Worker = function (u, o2) { note('worker', u); return new W(u, o2); };
  const I = window.Image; window.Image = function () { const i = new I(...arguments); const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(i, 'src', { set(v) { note('image', v); d.set.call(i, v); }, get() { return d.get.call(i); } }); return i; };
}

exports.run = async ({ browser, base, t }) => {
  const origin = new URL(base).origin;
  const sameOrigin = u => u.startsWith(origin + '/') || /^(data:|blob:|about:)/.test(u);

  /* ---------- runtime: use everything, watch everything ---------- */
  t.scope('clientside › nothing leaves the browser while it is used');
  const p = await newPage(browser, { init: { fn: spy } });
  const seen = [];
  p.ctx.on('request', r => seen.push(r.url()));
  const dl = async sel => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); return d.path(); };
  await p.goto(base + 'wt-log-analyzer.html');
  await p.waitForFunction(() => window.__wtReady === true);
  await p.click('#loadExampleBtn'); await p.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent));
  await p.click('#colourBtn'); await p.waitForSelector('#colourPanel:not([hidden])');
  await p.click('#themePicker .swatch[data-preset="violet"]'); await p.keyboard.press('Escape');
  await p.click('#tutorialBtn'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  await p.evaluate(() => window.print = () => {}); await p.click('#printBtn');
  await dl('#exportBtn');
  await p.click('#minimalToggle'); await dl('#exportBtn'); await p.click('#minimalToggle');
  const rawFile = await dl('#rawExportBtn');
  await p.setInputFiles('#importFile', rawFile); await p.waitForTimeout(600);
  await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick');
  await p.click('#libTable tr.pick >> nth=0'); await p.waitForSelector('#detailBody .stat-row');
  await p.evaluate(() => document.querySelectorAll('#insightsSection details').forEach(d => { d.open = true; }));
  await p.waitForFunction(() => document.querySelectorAll('#vehicleTable tr').length > 1, null, { timeout: 15000 });
  await dl('#exportRawGz'); await dl('#exportRawJson');
  await p.goto(base + 'wt-log-analyzer.html'); await p.waitForFunction(() => window.__wtReady === true);
  const calls = await p.evaluate(() => window.__net || []);
  t.check('every request the browser made over the whole session was to this site itself', seen.length > 10 && seen.every(sameOrigin), seen.filter(u => !sameOrigin(u)).join(' | '));
  t.check('the page itself never called fetch / XHR / beacon / WebSocket / EventSource / Image with another address', calls.every(c => sameOrigin(c.split(' ').slice(1).join(' '))), calls.filter(c => !sameOrigin(c.split(' ').slice(1).join(' '))).join(' | '));
  t.check('no uncaught errors and no blocked-by-policy errors during the session', p.errs.length === 0 && p.consoleErrs.length === 0, p.errs.concat(p.consoleErrs).join(' | '));
  await p.ctx.close();

  /* ---------- runtime: hostile data must not be able to phone home either ---------- */
  t.scope('clientside › hostile data cannot make a request');
  const q = await newPage(browser, { init: { fn: spy } });
  const seen2 = []; q.ctx.on('request', r => seen2.push(r.url()));
  const evil = 'Victory in the [<img src="https://evil.example/x.png">] <script src="https://evil.example/a.js"></script> mission! \nSession: abc123\nTotal: 100 SL, 50 CRP, 50 RP\n';
  await q.goto(base + 'wt-log-analyzer.html'); await q.waitForFunction(() => window.__wtReady === true);
  await q.evaluate(v => { document.getElementById('input').value = v; }, evil);
  await q.click('#analyzeBtn'); await q.waitForTimeout(600);
  t.check('a log containing external image/script addresses causes no request to them', !seen2.some(u => /evil\.example/.test(u)) && !(await q.evaluate(() => window.__net)).some(c => /evil\.example/.test(c)));
  await q.ctx.close();

  /* ---------- static: pages ---------- */
  t.scope('clientside › the shipped pages');
  for (const pg of PAGES) {
    const html = read(pg);
    const loads = [...html.matchAll(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*?\b(?:src|href|data)=["']([^"']+)["']/gi)].map(m => m[2]).filter(u => /^(https?:)?\/\//i.test(u));
    t.check(`${pg}: loads nothing from another site (no external scripts, styles, images, frames, fonts)`, loads.length === 0, loads.join(', '));
    const links = [...html.matchAll(/<a\b[^>]*?\bhref=["'](https?:[^"']+)["']/gi)].map(m => m[1]);
    const okLinks = pg.startsWith('docs/') ? ALLOWED_LINKS.concat(DOC_LINKS) : ALLOWED_LINKS;
    t.check(`${pg}: the only external addresses are plain links (the project's own GitHub pages${pg.startsWith('docs/') ? ' and the public references the docs cite' : ''})`, links.every(u => okLinks.some(re => re.test(u))), links.filter(u => !okLinks.some(re => re.test(u))).join(', '));
    const bad = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].filter(m => !/noopener/.test(m[0]) || !/noreferrer/.test(m[0])).length;
    t.check(`${pg}: links that open a new tab use rel="noopener noreferrer"`, bad === 0);
    t.check(`${pg}: tells the browser never to send a Referer`, /<meta name="referrer" content="no-referrer">/.test(html));
    const csp = (html.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
    const dir = n => (csp.match(new RegExp('(?:^|;)\\s*' + n + '\\s+([^;]*)')) || [])[1];
    t.check(`${pg}: has a Content-Security-Policy that denies everything by default`, dir('default-src') === "'none'", csp);
    t.check(`${pg}: policy allows scripts only from this site (no inline, no eval)`, !dir('script-src') || (dir('script-src').split(/\s+/).every(v => v === "'self'") && !/unsafe/.test(dir('script-src'))), csp);
    t.check(`${pg}: policy blocks frames, plugins, <base> and form posts`, [dir('frame-src'), dir('object-src'), dir('base-uri'), dir('form-action')].every(v => v === "'none'"), csp);
    t.check(`${pg}: policy allows connections to nowhere except this site`, !dir('connect-src') || /^('self'|'none')$/.test(dir('connect-src')), csp);
  }
  t.check('the two app pages also pin down workers, fonts, media and manifests', ['wt-log-analyzer.html', 'advanced.html'].every(pg => { const c = read(pg); return /worker-src 'self'/.test(c) && /font-src 'none'/.test(c) && /media-src 'none'/.test(c) && /manifest-src 'none'/.test(c); }));

  /* ---------- static: source code ---------- */
  t.scope('clientside › the source code');
  const sources = fs.readdirSync(path.join(ROOT, 'javascript')).filter(f => f.endsWith('.js')).map(f => ['javascript/' + f, read('javascript/' + f)]).concat([['sw.js', read('sw.js')]]);
  const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1'); // comments don't count
  const hits = re => sources.map(([f, s]) => [f, (code(s).match(re) || []).length]).filter(([, n]) => n).map(([f, n]) => `${f} ×${n}`);
  const none = (label, re) => t.check(`no source file uses ${label}`, hits(re).length === 0, hits(re).join(', '));
  none('XMLHttpRequest', /\bXMLHttpRequest\b/);
  none('sendBeacon', /\bsendBeacon\b/);
  none('WebSocket / EventSource / WebRTC', /\b(WebSocket|EventSource|RTCPeerConnection|RTCDataChannel)\b/);
  none('the camera, microphone, location, clipboard-read or other powerful device APIs', /\b(geolocation|mediaDevices|getUserMedia|clipboard\.read\b|Notification\.request|navigator\.bluetooth|navigator\.usb|PushManager)\b/);
  none('cookies', /document\.cookie\b/);
  none('eval, new Function, document.write or string timers', /\beval\s*\(|new Function\s*\(|document\.write(ln)?\s*\(|set(Timeout|Interval)\s*\(\s*['"`]/);
  none('absolute web addresses', /https?:\/\/[\w.-]+/);
  none('window.open or assigning location (no scripted navigation to anywhere)', /window\.open\s*\(|\blocation\s*(\.href)?\s*=[^=]/);
  none('importScripts with anything but a relative file name', /importScripts\s*\(\s*['"`](https?:|\/\/|\/)/);
  const fetches = sources.flatMap(([f, s]) => [...code(s).matchAll(/[^.\w]fetch\s*\(([^)]*)\)/g)].map(m => f + ': ' + m[1].trim()));
  t.check('the only fetch in the app is the sample data (the service worker only forwards same-origin requests)', fetches.every(x => /example%20data\/matches\.txt/.test(x) || x.startsWith('sw.js')), fetches.join(' | '));
  const swText = read('sw.js');
  t.check('the service worker ignores anything that is not a same-origin GET inside its own folder', /req\.method !== 'GET'\) return/.test(swText) && /url\.origin !== self\.location\.origin/.test(swText));
  t.check('there is no package.json: the site has no third-party runtime dependencies', !fs.existsSync(path.join(ROOT, 'package.json')));

  /* ---------- the exported report ---------- */
  t.scope('clientside › exported reports');
  const r = await newPage(browser);
  await r.goto(base + 'wt-log-analyzer.html'); await r.click('#loadExampleBtn'); await r.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
  const [d] = await Promise.all([r.waitForEvent('download'), r.click('#exportBtn')]);
  const rep = fs.readFileSync(await d.path(), 'utf8');
  const rcsp = (rep.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
  t.check('an exported HTML report denies all network access and allows only its own nonce-tagged script', /default-src 'none'/.test(rcsp) && /script-src 'nonce-/.test(rcsp) && !/connect-src|img-src|frame-src/.test(rcsp.replace(/default-src 'none'/, '')), rcsp);
  t.check('…loads nothing from another site, and sends no Referer', !/<(script|link|img|iframe)\b[^>]*(src|href)=["']https?:/i.test(rep) && /name="referrer" content="no-referrer"/.test(rep));
  await r.ctx.close();
};
