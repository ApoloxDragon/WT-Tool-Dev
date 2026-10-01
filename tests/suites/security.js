/* Security suite. Each check states the behaviour we WANT; on unhardened code some fail (that is the baseline). */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { newPage, withDeadline, norm } = require('../harness');
const { EX, exampleLog, splitBlocks, PAYLOADS, PWN, hostileBlock, gz, rawExportOf, REPORT_HTML } = require('../fixtures');

// Did anything execute, or did markup leak into the DOM as real elements?
// `allowScripts`: the exported report legitimately carries its own theme-picker <script>.
async function inert(page, scope = '#results', allowScripts = false) {
  return page.evaluate(({ sel, allowScripts }) => {
    const root = document.querySelector(sel) || document.body;
    // only INLINE scripts count: the pages' own <script src=…> tags are legitimate
    const q = 'img, svg, iframe, [onerror], [onload], [onclick], [onmouseover]' + (allowScripts ? '' : ', script:not([src])');
    return { pwn: window.__pwn || 0, injected: root.querySelectorAll(q).length };
  }, { sel: scope, allowScripts });
}
const verdict = async (page, scope, allowScripts) => { const r = await inert(page, scope, allowScripts); return { ok: r.pwn === 0 && r.injected === 0, detail: `executed=${r.pwn} injectedElements=${r.injected}` }; };
async function openBasic(browser, base, opts) { const p = await newPage(browser, opts); await p.goto(base + 'wt-log-analyzer.html'); return p; }
async function importFile(p, file) {
  await p.setInputFiles('#importFile', file);
  await p.waitForFunction(() => document.getElementById('importNote').textContent.length > 0);
  await p.click('#analyzeBtn');
  await p.waitForTimeout(300);
}
async function downloadText(page, sel) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); return fs.readFileSync(await d.path(), 'utf8'); }

exports.run = async ({ browser, base, t }) => {
  /* ---------- structural ---------- */
  t.scope('security › page structure');
  for (const pg of ['wt-log-analyzer.html', 'advanced.html']) {
    const p = await newPage(browser); await p.goto(base + pg);
    const s = await p.evaluate(() => ({
      csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '',
      inlineScripts: document.querySelectorAll('script:not([src])').length,
      inlineHandlers: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length,
      badBlank: [...document.querySelectorAll('a[target="_blank"]')].filter(a => !/noopener/.test(a.rel)).length
    }));
    t.check(`${pg}: has a Content-Security-Policy that blocks inline scripts`, /script-src[^;]*'self'/.test(s.csp) && !/script-src[^;]*unsafe-inline/.test(s.csp), s.csp || 'no CSP meta tag');
    t.check(`${pg}: CSP forbids plugins, base-tag and form hijacking`, /object-src 'none'/.test(s.csp) && /base-uri 'none'/.test(s.csp) && /form-action 'none'/.test(s.csp), s.csp || 'no CSP meta tag');
    t.check(`${pg}: no inline <script> or inline on* handlers`, s.inlineScripts === 0 && s.inlineHandlers === 0, JSON.stringify(s));
    t.check(`${pg}: every target=_blank link has rel=noopener`, s.badBlank === 0);
    await p.ctx.close();
  }
  const reqs = [];
  { const p = await newPage(browser); p.on('request', r => reqs.push(r.url()));
    await p.goto(base + 'wt-log-analyzer.html'); await p.click('#loadExampleBtn'); await p.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent));
    await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick'); await p.click('#libTable tr.pick >> nth=0');
    await p.evaluate(() => document.getElementById('tutorialBtn').click()); await p.waitForTimeout(600);
    t.check('no request ever leaves this site while using both views (data stays local)', reqs.every(u => u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')), reqs.filter(u => !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')).join(', '));
    t.check('no CSP violations or console errors during a normal session', p.consoleErrs.length === 0, p.consoleErrs.join(' | '));
    await p.ctx.close(); }

  /* ---------- injection: every way text can get into the page ---------- */
  t.scope('security › injection via pasted log (Basic)');
  for (const [name, payload] of Object.entries(PAYLOADS)) {
    const p = await openBasic(browser, base);
    const block = hostileBlock({ mission: payload, mode: payload });
    await p.evaluate(v => { document.getElementById('input').value = v; }, block);
    await p.click('#analyzeBtn'); await p.waitForTimeout(300);
    const v = await verdict(p);
    t.check(`mission + mode containing ${name} payload renders as text`, v.ok, v.detail);
    if (name === 'img') t.check('the hostile text is still visible (shown literally, not dropped)', /onerror/.test(await p.textContent('#matchTable')));
    await p.ctx.close();
  }

  t.scope('security › injection via imported files (Basic)');
  const hostileMin = Object.entries(PAYLOADS).map(([k, pl], i) => ({ id: 'abcdef00000000' + i, r: 'W', c: pl, m: pl, sl: 100, rp: 50, t: 60, tg: [{ n: pl, v: 5 }] }));
  hostileMin.push({ id: 'ab"><img src=x onerror=' + PWN + '>', r: 'L', c: 'Random Battles', m: 'attr id', sl: 1, rp: 1, t: 1, tg: [] });
  { const p = await openBasic(browser, base);
    await importFile(p, { name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(hostileMin)) });
    const v = await verdict(p, 'body');
    t.check('minimal JSON with hostile category/mission/target/id renders as text', v.ok, v.detail);
    t.check('goal-category dropdown options stay plain text', (await inert(p, '#goalCategory')).injected === 0);
    // exported report made from hostile data
    const html = await downloadText(p, '#exportBtn');
    const q = await newPage(browser); await q.setContent(html); await q.waitForTimeout(400);
    const v2 = await verdict(q, 'body', true);
    t.check('the exported HTML report made from hostile data is inert when opened', v2.ok && !/<script>\s*window\.__pwn/.test(html), v2.detail);
    t.check('the exported report declares its own Content-Security-Policy', /Content-Security-Policy/i.test(html));
    const re = await openBasic(browser, base);
    fs.writeFileSync(path.join(__dirname, '..', 'results', '.tmp-hostile.html'), html);
    await importFile(re, path.join(__dirname, '..', 'results', '.tmp-hostile.html')); fs.unlinkSync(path.join(__dirname, '..', 'results', '.tmp-hostile.html'));
    const v3 = await verdict(re, 'body');
    t.check('re-importing that hostile report is also inert', v3.ok, v3.detail);
    await re.ctx.close(); await q.ctx.close(); await p.ctx.close(); }

  { // hostile cells inside an HTML report
    const report = fs.readFileSync(EX(REPORT_HTML), 'utf8')
      .replace(/(<tr class="[^"]*" data-session="[^"]+" data-time="\d+">\s*<td class="result">[^<]+<\/td>\s*<td>)[^<]*(<\/td>)/, `$1${PAYLOADS.img.replace(/</g, '&lt;').replace(/>/g, '&gt;')}$2`)
      .replace(/data-session="([^"]+)"/, 'data-session="$1&quot;&gt;&lt;img src=x onerror=' + PWN + '&gt;"');
    const p = await openBasic(browser, base);
    await importFile(p, { name: 'hostile-report.html', mimeType: 'text/html', buffer: Buffer.from(report) });
    const v = await verdict(p, 'body');
    t.check('HTML report with hostile category and session-id cells is inert', v.ok, v.detail);
    await p.ctx.close(); }

  { // raw export with hostile names
    const p = await openBasic(browser, base);
    await importFile(p, { name: 'hostile-raw.json.gz', mimeType: 'application/gzip', buffer: gz(rawExportOf([hostileBlock({ mission: PAYLOADS.img, mode: PAYLOADS.svg })])) });
    const v = await verdict(p, 'body');
    t.check('raw export with hostile mission/mode is inert in Basic', v.ok, v.detail);
    await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick'); await p.click('#libTable tr.pick >> nth=0'); await p.waitForSelector('#detailBody .stat-row');
    await p.evaluate(() => document.querySelectorAll('#detailBody details').forEach(d => d.open = true));
    const v2 = await verdict(p, 'body');
    t.check('the same hostile match is inert in the Advanced view (library + detail)', v2.ok, v2.detail);
    await p.ctx.close(); }

  t.scope('security › injection via category rules');
  { const p = await openBasic(browser, base);
    const label = `Evil"><img src=x onerror=${PWN}>`;
    await p.evaluate(() => { document.querySelector('details.rules-toggle').open = true; });
    await p.fill('#newKeyword', 'Domination'); await p.fill('#newLabel', label); await p.click('#addRuleBtn');
    const val = await p.$$eval('#rulesList input', i => i.map(x => x.value));
    t.check('a label containing quotes and tags is stored and shown exactly as typed', val.includes(label), JSON.stringify(val));
    await p.evaluate(v => { document.getElementById('input').value = v; }, hostileBlock({}));
    await p.click('#analyzeBtn'); await p.waitForTimeout(300);
    const v = await verdict(p, 'body');
    t.check('such a label is inert in the rules editor, tables and dropdown', v.ok, v.detail);
    await p.reload(); await p.waitForTimeout(300);
    const v2 = await verdict(p, 'body');
    t.check('and still inert after reload (it is persisted)', v2.ok, v2.detail);
    await p.ctx.close(); }

  /* ---------- names that collide with object properties ---------- */
  t.scope('security › property-name collisions');
  { const names = ['constructor', 'toString', 'hasOwnProperty', 'valueOf'];
    const block = splitBlocks(exampleLog())[0]
      .replace(/^(Victory|Defeat) in the \[[^\]]+\]\s+.+?\s+mission!/, '$1 in the [Domination] constructor mission!')
      .replace(/Researched unit: \n.*\n/, 'Researched unit: \nconstructor: 500 RP\ntoString: 7 RP\n')
      .replace(/^( +)T-72M1\(Germany\)(\s+\d+%\s+\d+:\d+)/m, '$1constructor$2')
      .replace(/Session:\s*[a-f0-9]+/, 'Session: deadbeef0000002');
    const p = await openBasic(browser, base);
    await p.evaluate(v => { document.getElementById('input').value = v; }, block);
    await p.click('#analyzeBtn'); await p.waitForTimeout(300);
    const tt = norm(await p.innerText('#targetTable'));
    t.check('research targets called "constructor"/"toString" are summed as numbers (no NaN / function text)', /constructor 500/.test(tt) && /toString 7/.test(tt) && !/NaN|function/.test(tt), tt.slice(0, 200));
    t.check('no uncaught errors in Basic with property-name data', p.errs.length === 0, p.errs.join(' | '));
    await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick');
    await p.evaluate(() => document.querySelectorAll('#insightsSection details').forEach(d => d.open = true));
    await p.waitForFunction(() => document.querySelectorAll('#vehicleTable tr').length > 1);
    const mt = norm(await p.innerText('#mapTable')), vt = norm(await p.innerText('#vehicleTable'));
    t.check('a map named "constructor" gets a proper row in the Advanced by-map table', /constructor 1 \d+%/.test(mt) && !/NaN|function/.test(mt), mt.slice(0, 200));
    t.check('a vehicle named "constructor" gets a proper row in the by-vehicle table', /constructor 1 /.test(vt) && !/NaN|function/.test(vt), vt.slice(0, 240));
    t.check('no uncaught errors in Advanced with property-name data', p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close(); }

  /* ---------- malformed / wrong-typed data ---------- */
  t.scope('security › malformed imports');
  { const weird = [null, 5, 'x', [], { id: 'aaaa1111bbbb2222', r: 'W', c: { a: 1 }, m: 123, sl: 'abc', rp: {}, t: null, tg: 'notarray' },
      { id: 'bbbb1111cccc2222', r: 'L', c: 'Random Battles', m: 'Ok', sl: 100, rp: 50, t: 10, tg: [{ n: 'T', v: 5 }] },
      { id: 'cccc1111dddd2222', r: 'W', c: 'x'.repeat(100000), m: 'y'.repeat(100000), sl: 1e30, rp: -5, t: Infinity, tg: new Array(3000).fill({ n: 'z', v: 1 }) }];
    const p = await openBasic(browser, base);
    await importFile(p, { name: 'weird.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(weird)) });
    t.check('wrong-typed entries cause no uncaught exception', p.errs.length === 0, p.errs.join(' | '));
    const st = norm(await p.textContent('#overallStats').catch(() => ''));
    t.check('the valid entry is still analysed and the stats contain no NaN/Infinity', /MATCHES/.test(st) && !/NaN|Infinity/.test(st), st);
    const cellLen = await p.$$eval('#matchTable td', tds => Math.max(0, ...tds.map(t => t.textContent.length)));
    t.check('absurdly long strings are clipped, not rendered in full', cellLen < 2000, cellLen + ' chars in one cell');
    await p.ctx.close(); }
  { const p = await openBasic(browser, base);
    await importFile(p, { name: 'notjson.json', mimeType: 'application/json', buffer: Buffer.from('{not valid json at all') });
    t.check('invalid JSON is rejected with a message and no uncaught error', p.errs.length === 0 && (await p.textContent('#importNote')).length > 0, p.errs.join(' | '));
    await p.ctx.close(); }

  t.scope('security › tampered browser storage');
  { const tamper = { importedMatches: 'notanarray', categoryRules: { a: 1 }, theme: "x'; window.__pwn=1; '", inputText: 5, goalWinRate: 'x' };
    const init = { fn: o => { Object.entries(o).forEach(([k, v]) => localStorage.setItem('wtSessionReadout.' + k, JSON.stringify(v))); }, arg: tamper };
    const p = await newPage(browser, { init });
    await p.goto(base + 'wt-log-analyzer.html'); await p.waitForTimeout(400);
    t.check('Basic still loads when saved settings are the wrong type (no uncaught error)', p.errs.length === 0, p.errs.join(' | '));
    let ok = true; try { await p.click('#loadExampleBtn'); await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1, null, { timeout: 8000 }); } catch (e) { ok = false; }
    t.check('…and can still analyze the example log afterwards', ok, p.errs.join(' | '));
    let exported = ''; try { exported = await downloadText(p, '#exportBtn'); } catch (e) { exported = ''; }
    t.check('…and can still export an HTML report with a corrupted theme setting', exported.length > 1000, p.errs.join(' | '));
    const q = await newPage(browser); await q.setContent(exported || '<p>none</p>'); await q.waitForTimeout(300);
    t.check('…and that report does not execute the tampered theme string', ((await q.evaluate(() => window.__pwn || 0)) === 0));
    await p.goto(base + 'advanced.html'); await p.waitForTimeout(600);
    t.check('Advanced also loads with tampered settings (no uncaught error)', p.errs.length === 0, p.errs.join(' | '));
    await q.ctx.close(); await p.ctx.close(); }

  t.scope('security › resource limits');
  { // decompression bomb: ~160 KB file that expands to 160 MB
    const bomb = zlib.gzipSync(Buffer.alloc(160 * 1024 * 1024, 0x20), { level: 9 });
    for (const pg of ['basic', 'advanced']) {
      const t0 = Date.now();
      const r = await withDeadline(browser, 40000, async p => {
        if (pg === 'basic') { await p.goto(base + 'wt-log-analyzer.html'); await p.setInputFiles('#importFile', { name: 'bomb.json.gz', mimeType: 'application/gzip', buffer: bomb }); await p.waitForFunction(() => document.getElementById('importNote').textContent.length > 0, null, { timeout: 35000 }); var msg = await p.textContent('#importNote'); }
        else { await p.goto(base + 'advanced.html'); await p.setInputFiles('#importRawFile', { name: 'bomb.json.gz', mimeType: 'application/gzip', buffer: bomb }); await p.waitForFunction(() => document.getElementById('storageMsg').textContent.length > 0, null, { timeout: 35000 }); var msg = await p.textContent('#storageMsg'); }
        const alive = await p.evaluate(() => 1 + 1);
        return { msg, alive, errs: p.errs.slice() };
      });
      const ms = Date.now() - t0;
      t.metric(`decompression bomb handling time — ${pg}`, ms);
      t.check(`${pg}: a 160 KB → 160 MB gzip bomb is refused quickly with a clear message`, r.ok && r.result.alive === 2 && /too large|too big|limit/i.test(r.result.msg) && ms < 15000, r.ok ? `${r.result.msg.slice(0, 100)} (${ms} ms)` : r.error);
    }
  }
  { // oversized block must not be archived
    const big = splitBlocks(exampleLog())[0].replace(/(Session:)/, 'x'.repeat(10) + '\n' + ('    filler line ' + 'y'.repeat(80) + '\n').repeat(4000) + '$1').replace(/Session:\s*[a-f0-9]+/, 'Session: deadbeef0000003');
    const p = await openBasic(browser, base);
    await p.evaluate(v => { document.getElementById('input').value = v; }, big);
    await p.click('#analyzeBtn'); await p.waitForTimeout(800);
    t.check('a single 400 KB "match" is analysed but not written to the archive', (await p.evaluate(async () => (await WtDB.ids()).length)) === 0, big.length + ' chars');
    await p.ctx.close(); }
};
