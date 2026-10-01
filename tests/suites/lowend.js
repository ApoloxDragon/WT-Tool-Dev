/* Low-end suite (opt-in: `node tests/run.js --only lowend`, or LOWEND_PART=net,cpu,hot,mem,fail to pick parts).
 * Simulates bad connections (Chromium's network throttling), slow processors (CPU throttling, a stand-in for
 * low-end phones), and scripts that fail or stall. Mostly measurements, plus a few checks for things that
 * should hold however bad conditions get (no flash of the wrong theme, core features survive a missing script).
 * Writes the details (tables, profiler hot spots) to tests/results/low-end-details.json. */
const fs = require('fs'), path = require('path');
const { ROOT, newPage, startServer } = require('../harness');
const { syntheticLog } = require('../fixtures');

const CRIMSON = { bg: '#170e10', panel: '#211519', panel2: '#2b1b20', border: '#4a2a32', accent: '#ec6a80', text: '#f3e3e6', dim: '#b58b93', win: '#86c98d', loss: '#f0906c' };
const LOOK = { v: 1, presetId: 'crimson', colours: CRIMSON, font: 'mono', size: 'medium' };
const KB = 1024;
// Network figures are bytes/second; rtt is the round-trip latency added to every request.
const PROFILES = [
  { name: 'No throttling (control)',                     cpu: 1,  down: -1,        rtt: 0 },
  { name: 'Slow 4G + mid-range phone (CPU 4x)',          cpu: 4,  down: 1.6e6 / 8, rtt: 150 },
  { name: 'Slow 3G + low-end phone (CPU 6x)',            cpu: 6,  down: 400e3 / 8, rtt: 400 },
  { name: 'Awful 2G-like + very low-end phone (CPU 20x)', cpu: 20, down: 100e3 / 8, rtt: 1500 }
];
const CPUS = [1, 4, 6, 20];
const BASIC = 'wt-log-analyzer.html', ADV = 'advanced.html';
const details = {};

async function throttle(page, { cpu = 1, down = -1, rtt = 0 }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: down, uploadThroughput: down });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return cdp;
}

// Runs before the page's own scripts: saved look, timestamps for first paint / "app ready" / library rows, long tasks, per-frame colour.
function probe({ look }) {
  if (look) { localStorage.setItem('wtSessionReadout.appearance', JSON.stringify(look)); }
  localStorage.setItem('wtSessionReadout.tutorialSeen.basic', 'true');
  localStorage.setItem('wtSessionReadout.tutorialSeen.advanced', 'true');
  const m = window.__m = { fcp: null, ready: null, rows: null, long: [], frames: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; })).observe({ type: 'paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => m.long.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  new MutationObserver(() => {
    if (!m.ready && document.getElementById('colourBtn')) m.ready = performance.now();       // the last control the page's own scripts add
    if (!m.rows && document.querySelector('#libTable tr.pick')) m.rows = performance.now();   // Advanced: first library row
  }).observe(document, { childList: true, subtree: true });
  const loop = () => { const r = document.documentElement; if (r) m.frames.push(getComputedStyle(r).getPropertyValue('--bg').trim()); if (m.frames.length < 600) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

async function measureLoad(page, url, wantRows) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  const loadWall = Date.now() - t0;
  await page.waitForFunction(w => window.__m.ready && (!w || window.__m.rows), wantRows, { timeout: 180000, polling: 100 });
  await page.waitForTimeout(300);
  return page.evaluate(loadWall => {
    const m = window.__m, nav = performance.getEntriesByType('navigation')[0], res = performance.getEntriesByType('resource');
    return {
      fcp: m.fcp, ready: m.ready, rows: m.rows, load: nav.loadEventEnd, loadWall,
      tbt: m.long.reduce((a, d) => a + Math.max(0, d - 50), 0), longCount: m.long.length, longMax: Math.max(0, ...m.long),
      requests: res.filter(r => r.transferSize > 0).length + 1, kb: Math.round((res.reduce((a, r) => a + (r.transferSize || 0), 0) + (nav.transferSize || 0)) / 1024 * 10) / 10,
      wrongFrames: m.frames.filter(f => f && f !== '#170e10').length, frames: m.frames.length
    };
  }, loadWall);
}

// Self time per function from a CDP CPU profile.
function topFunctions(profile, n = 8) {
  const byId = new Map(profile.nodes.map(x => [x.id, x]));
  const self = new Map(); let total = 0;
  profile.samples.forEach((id, i) => {
    const dt = profile.timeDeltas[i] || 0; total += dt;
    const cf = byId.get(id).callFrame;
    const key = (cf.functionName || '(anonymous)') + '  ' + (cf.url ? path.basename(cf.url) + ':' + (cf.lineNumber + 1) : '');
    self.set(key, (self.get(key) || 0) + dt);
  });
  return { totalMs: Math.round(total / 1000), top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ fn: k, ms: Math.round(v / 100) / 10, pct: Math.round(v / total * 100) })) };
}
async function profiled(cdp, fn) {
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await fn();
  const { profile } = await cdp.send('Profiler.stop');
  return topFunctions(profile);
}

exports.run = async ({ browser, t }) => {
  const parts = (process.env.LOWEND_PART || 'net,cpu,hot,mem,fail').split(',');
  // LOWEND_SITE=/path/to/an/older/checkout measures that copy instead (used for the before/after comparison in the report)
  const srv = await startServer({ gzip: true, cache: 600, root: process.env.LOWEND_SITE }); // behave like GitHub Pages: gzip + 10-minute cache
  const B = srv.url;
  try {

  /* ================= network + CPU: page loads ================= */
  if (parts.includes('net')) {
    const seed = syntheticLog(200);
    details.net = {};
    for (const prof of PROFILES) {
      t.scope(`lowend › load › ${prof.name}`);
      const p = await newPage(browser, { init: { fn: probe, arg: { look: LOOK } } });
      await p.goto(B + BASIC);
      await p.evaluate(async src => { await archiveParsedMatches(parseLog(src)); }, seed);      // 200 saved matches for the Advanced view
      const cdp = await throttle(p, prof);
      for (const [label, url, rows] of [['Basic', B + BASIC, false], ['Advanced (200 saved matches)', B + ADV, true]]) {
        await cdp.send('Network.clearBrowserCache');
        const cold = await measureLoad(p, url, rows);
        const warm = await measureLoad(p, url, rows);
        for (const [visit, r] of [['first visit', cold], ['return visit', warm]]) {
          const k = `${label} › ${visit}`;
          t.metric(`${k} › first paint`, r.fcp); t.metric(`${k} › app usable`, r.ready); if (rows) t.metric(`${k} › library rows shown`, r.rows);
          t.metric(`${k} › blocked main thread (TBT)`, r.tbt); t.metric(`${k} › KB over the wire`, r.kb);
          t.check(`${k}: the saved look is on every one of the ${r.frames} painted frames (no flash of Blue)`, r.frames > 0 && r.wrongFrames === 0, `${r.wrongFrames} wrong frames`);
        }
        (details.net[prof.name] = details.net[prof.name] || {})[label] = { cold, warm };
      }
      await p.ctx.close();
    }
    t.scope('lowend › load › budgets');
    const g = (prof, page, visit, f) => details.net[prof][page][visit][f];
    t.check('with a warm cache, even the worst connection has the Basic page usable within 3 s', g(PROFILES[3].name, 'Basic', 'warm', 'ready') < 3000, Math.round(g(PROFILES[3].name, 'Basic', 'warm', 'ready')) + ' ms');
    t.check('a first visit costs under 70 KB over the wire', g(PROFILES[0].name, 'Basic', 'cold', 'kb') < 70, g(PROFILES[0].name, 'Basic', 'cold', 'kb') + ' KB');
  }

  /* ================= CPU: what the app costs on slow processors ================= */
  if (parts.includes('cpu')) {
    details.cpu = {};
    for (const cpu of CPUS) for (const n of [200, 2000]) {
      t.scope(`lowend › CPU ${cpu}x › ${n} matches`);
      const src = syntheticLog(n);
      const p = await newPage(browser, { init: { fn: probe, arg: { look: LOOK } } });
      await p.goto(B + BASIC);
      await throttle(p, { cpu });
      const r = await p.evaluate(async src => {
        const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const out = {}, long = [];
        try { new PerformanceObserver(l => l.getEntries().forEach(e => long.push(e.duration))).observe({ type: 'longtask' }); } catch (e) {}
        let t0 = performance.now(); parseLog(src); out.parse = performance.now() - t0;
        document.getElementById('input').value = src; await frame();   // pasting is the browser's own cost (a huge textarea), so it is not part of what is timed
        t0 = performance.now(); analyze(); out.analyzeSync = performance.now() - t0; await frame(); out.analyzeToPaint = performance.now() - t0;
        await pendingArchiveWrites; out.archiveDone = performance.now() - t0;
        t0 = performance.now(); ColourPanel.open(); await frame(); out.panelOpen = performance.now() - t0; ColourPanel.close();
        t0 = performance.now(); applyPresetById('violet'); await frame(); out.swatch = performance.now() - t0;
        t0 = performance.now(); Tutorial.start('basic'); await frame(); out.tutorial = performance.now() - t0;
        out.longTasks = long.length; out.tbt = long.reduce((a, d) => a + Math.max(0, d - 50), 0); out.longMax = Math.max(0, ...long);
        return out;
      }, src);
      const t0 = Date.now();
      await p.goto(B + ADV); await p.waitForSelector('#libTable tr.pick', { timeout: 180000 });
      r.advancedRows = Date.now() - t0;
      const a = await p.evaluate(async () => {
        const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const out = {}; const id = library[Math.floor(library.length / 2)].m.sessionId;
        let t0 = performance.now(); await selectMatch(id); await frame(); out.detail = performance.now() - t0;
        t0 = performance.now(); document.querySelectorAll('#insightsSection details').forEach(d => { d.open = true; });
        while (!(document.querySelectorAll('#vehicleTable tr').length > 1 && document.querySelectorAll('#eventTable tr').length > 1)) await new Promise(r => setTimeout(r, 25));
        out.insights = performance.now() - t0;
        return out;
      });
      Object.assign(r, a);
      for (const [k, label] of [['parse', 'parse the pasted log'], ['analyzeSync', 'Analyze: compute + build tables'], ['analyzeToPaint', 'Analyze: click until the screen updates'], ['archiveDone', 'Analyze: until saved to the archive'], ['tbt', 'Analyze flow: blocked main thread (TBT)'],
        ['advancedRows', 'open Advanced until the first row shows'], ['detail', 'open one match detail'], ['insights', 'fill the vehicle + event insights'], ['panelOpen', 'open the colour panel'], ['swatch', 'switch preset (click until repaint)'], ['tutorial', 'start the tutorial']]) t.metric(label, r[k]);
      details.cpu[`${cpu}x`] = details.cpu[`${cpu}x`] || {}; details.cpu[`${cpu}x`][n] = r;
      await p.ctx.close();
    }
  }

  /* ================= where the time goes (CPU profiler) ================= */
  if (parts.includes('hot')) {
    details.hot = {};
    const n = 2000, src = syntheticLog(n);
    t.scope(`lowend › hot spots (${n} matches, no throttling)`);
    let p = await newPage(browser, { init: { fn: probe, arg: { look: LOOK } } });
    const cdp = await p.context().newCDPSession(p);
    details.hot['page boot (Basic)'] = await profiled(cdp, async () => { await p.goto(B + BASIC); await p.waitForFunction(() => window.__m.ready); });
    details.hot['Analyze'] = await profiled(cdp, () => p.evaluate(async src => { document.getElementById('input').value = src; analyze(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await pendingArchiveWrites; }, src));
    details.hot['open Advanced'] = await profiled(cdp, async () => { await p.goto(B + ADV); await p.waitForSelector('#libTable tr.pick'); });
    details.hot['insights (all matches)'] = await profiled(cdp, () => p.evaluate(async () => { document.querySelectorAll('#insightsSection details').forEach(d => { d.open = true; }); while (!(document.querySelectorAll('#vehicleTable tr').length > 1)) await new Promise(r => setTimeout(r, 25)); }));
    for (const [k, v] of Object.entries(details.hot)) t.metric(`${k}: sampled main-thread time`, v.totalMs);
    await p.ctx.close();
  }

  /* ================= memory + DOM size ================= */
  if (parts.includes('mem')) {
    details.mem = {};
    for (const n of [200, 2000, 6000]) {
      t.scope(`lowend › memory › ${n} matches`);
      const p = await newPage(browser);
      await p.goto(B + BASIC);
      const m = await p.evaluate(async src => {
        const heap = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null);
        const before = heap(); document.getElementById('input').value = src; analyze(); await pendingArchiveWrites;
        return { before, after: heap(), nodes: document.querySelectorAll('*').length, rows: document.querySelectorAll('#matchTable tr').length, textareaKB: Math.round(src.length / 1024) };
      }, syntheticLog(n));
      t.metric('DOM nodes after Analyze (count)', m.nodes); t.metric('rows in the per-match table (count)', m.rows); t.metric('JS heap after Analyze (MB)', m.after);
      details.mem[n] = m;
      await p.ctx.close();
    }
  }

  /* ================= files that fail or stall ================= */
  if (parts.includes('fail')) {
    details.fail = {};
    // The page now loads ONE core bundle (gates being usable), one deferred "extras" bundle (tutorial, colour panel, import/export,
    // archive tools) and a compression worker file. Each is blocked in turn.
    const BLOCKS = [
      ['dist/app-basic.js', 'the core bundle', false],
      ['dist/extras.js', 'the extras bundle (tutorial, colour panel, import/export, archive)', true],
      ['javascript/archive-worker.js', 'the compression worker', true],
      ['css/styles.css', 'the stylesheet', true]
    ];
    for (const [file, label, analysisExpected] of BLOCKS) {
      t.scope(`lowend › a file never arrives › ${file}`);
      const p = await newPage(browser, { init: { fn: probe, arg: { look: LOOK } } });
      await p.route(`**/${file}*`, r => r.abort());
      await p.goto(B + BASIC, { waitUntil: 'load' }); await p.waitForTimeout(800);
      let works = true;
      try { await p.click('#loadExampleBtn', { timeout: 2000 }); await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1, null, { timeout: 3000 }); } catch (e) { works = false; }
      const info = await p.evaluate(() => ({ look: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), notice: !!document.querySelector('.load-note') && document.querySelector('.load-note').textContent.slice(0, 100) }));
      details.fail[file] = { analysisWorks: works, lookKept: info.look === CRIMSON.bg, errors: p.errs.length, visibleNotice: info.notice };
      t.metric('uncaught errors (count)', p.errs.length);
      if (analysisExpected) t.check(`analysis still works without ${file} (${label})`, works, `${p.errs.length} errors; ${p.errs[0] || ''}`.slice(0, 160));
      else t.check(`without ${file} (${label}) the page says so instead of sitting there dead`, !!info.notice, String(info.notice));
      await p.ctx.close();
    }
    t.scope('lowend › a file stalls (connection hangs mid-load)');
    // "Hangs" = held for 12 s (longer than the 9 s we watch for) and then dropped, so the test can end cleanly.
    for (const [file, label, ms, hang] of [['dist/extras.js', 'the extras bundle hangs', 12000, true], ['dist/app-basic.js', 'the core bundle takes 6 s', 6000, false]]) {
      const p = await newPage(browser, { init: { fn: probe, arg: { look: LOOK } } });
      await p.route(`**/${file}*`, async r => { await new Promise(res => setTimeout(res, ms)); try { await (hang ? r.abort() : r.continue()); } catch (e) {} });
      p.goto(B + BASIC, { waitUntil: 'commit' }).catch(() => {});
      let usableAt = null; const t0 = Date.now();
      while (Date.now() - t0 < 9000 && usableAt === null) {
        usableAt = await p.evaluate(() => typeof analyze === 'function' && !!document.getElementById('analyzeBtn') ? performance.now() : null).catch(() => null);
        if (usableAt === null) await p.waitForTimeout(150);
      }
      details.fail['stall: ' + label] = { analysisAvailableAfterMs: usableAt === null ? 'not within 9 s' : Math.round(usableAt) };
      if (usableAt !== null) t.metric(`${label}: Analyze becomes available (ms)`, usableAt);
      if (file.includes('extras')) t.check('a hung extras bundle never blocks Analyze', usableAt !== null && usableAt < 3000, String(usableAt));
      await p.ctx.close().catch(() => {});
    }
  }

  } finally {
    srv.close();
    // merge with earlier runs, so running the parts one at a time still builds up one complete file
    const file = path.join(__dirname, '..', 'results', 'low-end-details.json');
    let old = {}; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
    fs.writeFileSync(file, JSON.stringify({ ...old, ...details }, null, 1));
  }
};
