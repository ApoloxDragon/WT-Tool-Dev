/* Test harness: static server + Playwright launch + result collector.
 * Dev-only — the app itself has no build step and no dependencies. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.gz': 'application/gzip' };

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through to the global install */ }
  const globalRoot = cp.execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

// Options (all default to off, so the ordinary suites behave exactly as before):
//   gzip   compress text like GitHub Pages does        cache  seconds for a Cache-Control max-age header
//   etag   send ETags and answer If-None-Match with 304 (what a browser does once max-age has run out)
//   http2  speak HTTP/2 over TLS with a throw-away certificate (GitHub Pages is HTTP/2); the URL is then https://
//   root   serve this folder instead of the repository
function startServer(opts = {}) {
  const root = opts.root ? path.resolve(opts.root) : ROOT;
  const gzipCache = new Map();
  const handler = (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    const st = fs.statSync(file);
    const mime = MIME[path.extname(file)] || 'application/octet-stream';
    const headers = { 'Content-Type': mime };
    if (opts.cache != null) headers['Cache-Control'] = 'public, max-age=' + opts.cache;
    if (opts.etag) {
      headers.ETag = `W/"${st.size}-${Math.round(st.mtimeMs)}"`;
      if (req.headers['if-none-match'] === headers.ETag) { res.writeHead(304, headers); res.end(); return; }
    }
    const compressible = /^text\/|json|javascript/.test(mime);
    if (opts.gzip && compressible && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const key = file + st.mtimeMs;
      if (!gzipCache.has(key)) gzipCache.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 6 }));
      const buf = gzipCache.get(key);
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length, Vary: 'Accept-Encoding' });
      res.end(buf);
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  };
  return new Promise(resolve => {
    let server, scheme = 'http';
    if (opts.http2) {
      scheme = 'https';
      server = require('http2').createSecureServer({ key: fs.readFileSync('/tmp/h2/key.pem'), cert: fs.readFileSync('/tmp/h2/cert.pem'), allowHTTP1: true }, handler);
    } else server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ url: `${scheme}://127.0.0.1:${server.address().port}/`, close: () => server.close() }));
  });
}

async function launch() {
  const pw = loadPlaywright();
  const exe = process.env.WT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return pw.chromium.launch(exe ? { executablePath: exe } : {});
}

const sha = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Collects checks (pass/fail), snapshots (compared between runs) and metrics (timings).
function collector(label) {
  const out = { label, date: new Date().toISOString(), commit: '', checks: [], snapshots: {}, metrics: {} };
  try { out.commit = cp.execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { /* not a git checkout */ }
  let scope = '';
  const t = {
    out,
    scope(name) { scope = name; },
    check(name, pass, detail) {
      const full = scope ? `${scope} › ${name}` : name;
      out.checks.push({ name: full, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${full}${!pass && detail ? '  — ' + String(detail).slice(0, 160) : ''}`);
    },
    // `items` (optional): { id: value } so a mismatch can name WHICH item changed.
    snapshot(name, value, items) {
      const full = scope ? `${scope} › ${name}` : name;
      const s = { hash: sha(value) };
      if (typeof value === 'string' && value.length <= 200) s.preview = value;
      if (items) { s.items = {}; Object.keys(items).forEach(k => { s.items[k] = sha(items[k]); }); s.count = Object.keys(items).length; }
      out.snapshots[full] = s;
      console.log(`  SNAP  ${full}  ${s.hash}${s.count != null ? '  (' + s.count + ' items)' : ''}`);
    },
    metric(name, ms) {
      const full = scope ? `${scope} › ${name}` : name;
      out.metrics[full] = Math.round(ms * 10) / 10;
      console.log(`  TIME  ${full}  ${out.metrics[full]} ms`);
    }
  };
  return t;
}

// A fresh browser context (= empty storage) with the tutorials pre-dismissed, so they never block clicks.
async function newPage(browser, { tutorialSeen = true, init = null, viewport = { width: 1200, height: 900 } } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport, ignoreHTTPSErrors: true });
  if (tutorialSeen) {
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('wtSessionReadout.tutorialSeen.basic', 'true');
        localStorage.setItem('wtSessionReadout.tutorialSeen.advanced', 'true');
      } catch (e) { /* ignore */ }
    });
  }
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  page.errs = [];        // uncaught exceptions
  page.consoleErrs = []; // console.error output (CSP violations show up here)
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) page.consoleErrs.push(m.text()); });
  page.on('dialog', d => d.accept());
  page.ctx = ctx;
  return page;
}

// Runs fn(page) in a throwaway page and gives up after `ms` (a busy-looping page is killed).
async function withDeadline(browser, ms, fn, opts) {
  const page = await newPage(browser, opts);
  let timer;
  try {
    const result = await Promise.race([
      fn(page),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('deadline ' + ms + 'ms exceeded')), ms); })
    ]);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
    await page.ctx.close().catch(() => {});
  }
}

module.exports = { ROOT, startServer, launch, collector, newPage, withDeadline, sha, norm };
