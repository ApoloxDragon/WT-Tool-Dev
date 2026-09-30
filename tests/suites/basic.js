/* Basic view suite: analyze, goal calculator, categories, persistence, exports, imports. */
const fs = require('fs'), zlib = require('zlib');
const { newPage, norm, sha } = require('../harness');
const { EX, exampleLog, gz, rawExportOf, splitBlocks, REPORT_HTML } = require('../fixtures');

const text = id => async (page, sel) => norm(await page.textContent(sel));
async function download(page, clickSel) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(clickSel)]);
  const p = await dl.path();
  return { name: dl.suggestedFilename(), buf: fs.readFileSync(p) };
}
async function loadExample(page, base) {
  await page.goto(base + 'wt-log-analyzer.html');
  await page.click('#loadExampleBtn');
  await page.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
}

exports.run = async ({ browser, base, t }) => {
  let page = await newPage(browser);
  await loadExample(page, base);
  const T = sel => page.textContent(sel).then(norm);

  /* ---- analyze ---- */
  t.scope('basic › analyze (example log)');
  t.snapshot('overall stats', await T('#overallStats'));
  t.snapshot('battle-type split table', await T('#splitTable'));
  t.snapshot('RP by research target table', await T('#targetTable'));
  t.snapshot('other-RP (module/progress) table', await T('#progressTable'));
  t.snapshot('duplicate warning', await T('#dupeWarn'));
  const rows = await page.$$eval('#matchTable tr', trs => trs.slice(1).map(tr => [...tr.cells].map(c => c.textContent.trim()).join('|') + (tr.classList.contains('dupe') ? '|DUPE' : '')));
  t.check('per-match table lists all 84 matches, 17 of them struck through as duplicates', rows.length === 84 && rows.filter(r => r.endsWith('DUPE')).length === 17, `${rows.length} rows, ${rows.filter(r => r.endsWith('DUPE')).length} dupes`);
  t.check('duplicate rows have their SL/RP blanked (shown as —)', rows.filter(r => r.endsWith('DUPE')).every(r => r.split('|')[4] === '—' && r.split('|')[5] === '—'));
  t.snapshot('per-match table rows', rows, Object.fromEntries(rows.map((r, i) => ['row' + i, r])));
  t.check('archive note reports the 67 stored matches', /67 match/.test(await T('#archiveNote')) || await page.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent)).then(() => true).catch(() => false));

  /* ---- goal calculator ---- */
  t.scope('basic › goal calculator');
  t.snapshot('default fields loaded for "All Combined"', await page.$$eval('#goalWinRate,#goalAvgWinRP,#goalAvgLossRP,#goalAvgWinSL,#goalAvgLossSL', els => els.map(e => e.value).join(',')));
  await page.fill('#goalRpTarget', '50000'); await page.fill('#goalSlTarget', '300000');
  t.snapshot('result for 50,000 RP / 300,000 SL', await T('#goalOutput'));
  await page.click('#boosterToggle');
  t.snapshot('result with the +30% booster on', await T('#goalOutput'));
  await page.click('#boosterToggle');
  const cats = await page.$$eval('#goalCategory option', o => o.map(x => x.value));
  t.snapshot('goal category choices', cats.join(','));
  if (cats.includes('Tank Assault')) {
    await page.selectOption('#goalCategory', 'Tank Assault');
    t.snapshot('result after switching to Tank Assault averages', await T('#goalOutput'));
  }

  /* ---- categories ---- */
  t.scope('basic › battle-type categories');
  await page.evaluate(() => { document.querySelector('details.rules-toggle').open = true; });
  await page.fill('#newKeyword', 'Conquest'); await page.fill('#newLabel', 'Conquest Battles'); await page.click('#addRuleBtn');
  await page.click('#analyzeBtn');
  t.snapshot('split table after adding a Conquest rule', await T('#splitTable'));
  t.check('the new label appears as a category', /Conquest Battles/.test(await T('#splitTable')));

  /* ---- persistence ---- */
  t.scope('basic › persistence');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
  t.check('session (pasted text) is restored after reload', (await page.inputValue('#input')).length > 100000);
  t.check('custom category rule survives reload', /Conquest Battles/.test(await T('#splitTable')));
  await page.click('#clearBtn');
  t.check('Clear empties the input and hides results', (await page.inputValue('#input')) === '' && !(await page.isVisible('#results')));
  await page.reload();
  t.check('Clear is permanent across reload', (await page.inputValue('#input')) === '');
  t.check('Clear keeps the local archive', await page.evaluate(async () => (await WtDB.ids()).length) === 67);
  await page.ctx.close();

  /* ---- exports ---- */
  t.scope('basic › exports');
  page = await newPage(browser); await loadExample(page, base);
  await page.click('#minimalToggle');
  const min = await download(page, '#exportBtn');
  const minJson = JSON.parse(min.buf.toString('utf8'));
  t.check('minimal export filename is wt-session-data-<local time>.json', /^wt-session-data-\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.json$/.test(min.name), min.name);
  t.check('minimal export has 67 deduped matches with short keys', Array.isArray(minJson) && minJson.length === 67 && ['id', 'r', 'c', 'm', 'sl', 'rp', 't', 'tg'].every(k => k in minJson[0]));
  t.snapshot('minimal export content', minJson, Object.fromEntries(minJson.map(m => [m.id, m])));
  await page.click('#minimalToggle');
  const html = await download(page, '#exportBtn');
  const htmlText = html.buf.toString('utf8');
  t.check('HTML export filename is wt-session-report-<local time>.html', /^wt-session-report-\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.html$/.test(html.name), html.name);
  t.check('HTML report has 67 match rows and only unique matches', (htmlText.match(/data-session=/g) || []).length === 67 && !/class="[^"]*dupe/.test(htmlText));
  t.snapshot('HTML report body (generated-time stripped)', htmlText.replace(/Generated [^<]+/, 'Generated X').replace(/<title>[^<]+/, '<title>X'));
  const rawExp = await download(page, '#rawExportBtn');
  const rawJson = JSON.parse(zlib.gunzipSync(rawExp.buf).toString('utf8'));
  t.check('raw export is gzip JSON with all 67 archived matches and original text', rawJson.format === 'wt-raw-export' && rawJson.count === 67 && rawJson.matches.every(m => /^(Victory|Defeat) in the /.test(m.raw)));
  t.snapshot('raw export matches', rawJson.matches.map(m => m.raw), Object.fromEntries(rawJson.matches.map(m => [m.id, m.raw])));
  fs.writeFileSync(require('path').join(__dirname, '..', 'results', '.tmp-report.html'), htmlText);
  await page.ctx.close();

  /* ---- imports ---- */
  t.scope('basic › imports');
  async function importFile(file, name) {
    const p = await newPage(browser);
    await p.goto(base + 'wt-log-analyzer.html');
    await p.setInputFiles('#importFile', file);
    await p.waitForFunction(() => document.getElementById('importNote').textContent.length > 0);
    const note = norm(await p.textContent('#importNote'));
    await p.click('#analyzeBtn');
    const stats = await p.textContent('#overallStats').catch(() => '');
    const out = { note, stats: norm(stats), errs: p.errs.slice() };
    await p.ctx.close();
    return out;
  }
  const a = await importFile(EX('wt-session-data.json'));
  t.check('minimal JSON import: 67 matches', /Imported 67 match/.test(a.note), a.note); t.snapshot('minimal JSON import stats', a.stats);
  const b = await importFile(EX(REPORT_HTML));
  t.check('HTML report import: 201 matches', /Imported 201 match/.test(b.note), b.note); t.snapshot('HTML report import stats', b.stats);
  const c = await importFile({ name: 'raw.json.gz', mimeType: 'application/gzip', buffer: gz(rawExportOf(splitBlocks(exampleLog()))) });
  t.check('raw .json.gz import: 84 blocks read, 67 distinct added', /Imported 84 match/.test(c.note), c.note); t.snapshot('raw import stats', c.stats);
  const d = await importFile(EX('matches.txt'));
  t.check('plain .txt log import works', /Imported \d+ match/.test(d.note), d.note);
  const e = await importFile({ name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
  t.check('an unrelated JSON file is rejected politely (no crash)', /No importable|Could not/.test(e.note) && e.errs.length === 0, e.note + ' ' + e.errs.join(';'));
  const f = await importFile({ name: 'junk.html', mimeType: 'text/html', buffer: Buffer.from('<html><body>nothing here</body></html>') });
  t.check('an unrelated HTML file is rejected politely', /No importable|Could not/.test(f.note) && f.errs.length === 0, f.note);
  // round trip: exported HTML report re-imports to the same totals
  fs.writeFileSync(require('path').join(__dirname, '..', 'results', '.tmp-report.html'), htmlText);
  const g = await importFile(require('path').join(__dirname, '..', 'results', '.tmp-report.html'));
  const origStats = norm(await (async () => { const p = await newPage(browser); await loadExample(p, base); const s = await p.textContent('#overallStats'); await p.ctx.close(); return s; })());
  t.check('exported HTML report re-imports to the same match count, win rate and totals', g.stats === origStats, g.stats + ' vs ' + origStats);
  fs.unlinkSync(require('path').join(__dirname, '..', 'results', '.tmp-report.html'));
};
