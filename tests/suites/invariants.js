/* Size-agnostic suite: no check here names a match count. Every expected figure is derived from the
 * log being tested by an independent oracle (fixtures.oracle) and compared with what the app produces,
 * so the same checks hold for 1 match, 84, 216 or 1,001 — and for any example file added later.
 * Parser-level checks run on every dataset; the page-level ones (Analyze, archive, exports, Advanced)
 * run on those marked `ui` in fixtures.datasets(). */
const fs = require('fs'), zlib = require('zlib');
const { newPage, norm } = require('../harness');
const { oracle, datasets, splitBlocks, exampleLog } = require('../fixtures');

const digits = s => String(s).replace(/[^\d-]/g, '');
async function download(page, clickSel) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(clickSel)]);
  return { name: dl.suggestedFilename(), buf: fs.readFileSync(await dl.path()) };
}
// Sets the textarea directly (Playwright's fill() is very slow on a log of this size) and fires the same input event a paste would.
async function analyze(page, text) {
  await page.evaluate(v => { const e = document.getElementById('input'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await page.click('#analyzeBtn');
}
const statCells = page => page.$$eval('#overallStats .stat-cell', cs => Object.fromEntries(cs.map(c => [c.querySelector('.lbl').textContent.trim(), c.querySelector('.num').textContent.trim()])));

exports.run = async ({ browser, base, t, scale }) => {
  const sets = datasets(scale).map(d => ({ ...d, o: oracle(d.text) }));

  /* ---------- parser level: every dataset, one page ---------- */
  const page = await newPage(browser);
  await page.goto(base + 'wt-log-analyzer.html');
  for (const d of sets) {
    const o = d.o;
    t.scope(`invariants › parser › ${d.name}`);
    const r = await page.evaluate(src => {
      const ms = parseLog(src);
      return {
        n: ms.length, ids: ms.map(m => m.sessionId), results: ms.map(m => m.result), netSL: ms.map(m => m.netSL), rp: ms.map(m => m.totalRP),
        rawOk: ms.every(m => m.raw && m.raw.startsWith(m.result + ' in the [') && m.raw.includes(m.sessionId)),
        rawCoversInput: ms.map(m => m.raw).join('').replace(/\s/g, '').length <= src.replace(/\s/g, '').length,
        detail: ms.map(m => { const dt = parseDetail(m.raw); return { unparsed: dt.unparsed.length, events: dt.sections.reduce((a, s) => a + s.events.length, 0), session: dt.sessionId, hasTotal: !!dt.total }; }),
        lf: JSON.stringify(parseLog(src.replace(/\r\n/g, '\n')).map(m => ({ ...m, raw: undefined }))),
        crlf: JSON.stringify(parseLog(src.replace(/\r?\n/g, '\r\n')).map(m => ({ ...m, raw: undefined })))
      };
    }, d.text);
    t.check('finds exactly as many matches as there are headers in the text', r.n === o.all.length, `${r.n} vs ${o.all.length}`);
    t.check('matches come back in the order they appear, with the right Session IDs', JSON.stringify(r.ids) === JSON.stringify(o.all.map(m => m.id)));
    t.check('every result (Victory/Defeat) agrees', JSON.stringify(r.results) === JSON.stringify(o.all.map(m => m.result)));
    t.check('every match\'s net SL and RP agree with its Total: line', JSON.stringify(r.netSL) === JSON.stringify(o.all.map(m => m.sl)) && JSON.stringify(r.rp) === JSON.stringify(o.all.map(m => m.rp)));
    t.check('each match keeps its own raw text, and no text is invented', r.rawOk && r.rawCoversInput);
    t.check('detail parsing leaves no line unrecognised', r.detail.every(x => x.unparsed === 0), r.detail.filter(x => x.unparsed).length + ' matches');
    t.check('detail parsing finds one event per indented line, in every match', r.detail.every((x, i) => x.events === o.all[i].events), r.detail.filter((x, i) => x.events !== o.all[i].events).length + ' differ');
    const badDetail = r.detail.map((x, i) => ({ i, id: o.all[i].id, got: x.session, hasTotal: x.hasTotal })).filter(x => x.got !== x.id || !x.hasTotal);
    t.check('detail parsing reads the same Session ID and a total in every match', badDetail.length === 0, badDetail.length + ' bad, first: ' + JSON.stringify(badDetail[0]));
    t.check('CRLF and LF versions of the log parse identically', r.lf === r.crlf);
  }
  // The game leaves the trailing ", N RP" off the Total: line when there was no research progress.
  // (A copy of the app's own pattern can't catch this, so it is checked on its own, with fixed numbers.)
  t.scope('invariants › parser › Total: line without the trailing RP figure');
  {
    const withTotal = line => splitBlocks(exampleLog())[0].replace(/^Total:.*$/m, line).replace(/(\n\s*)+$/, '') + '\n';
    const cases = { 'two figures': ['Total: 4570 SL, 1912 CRP', 4570, 1912], 'three figures': ['Total: 4570 SL, 1912 CRP, 2414 RP', 4570, 1912],
      'with thousands separators': ['Total: 1,234,567 SL, 89,012 CRP', 1234567, 89012] };
    for (const [name, [line, sl, crp]] of Object.entries(cases)) {
      const r = await page.evaluate(src => { const [m] = parseLog(src); const d = parseDetail(m.raw); return { sl: m.netSL, rp: m.totalRP, endsWithTotal: /Total:[^\n]*$/.test(m.raw), dsl: d.total && d.total.sl, dcrp: d.total && d.total.crp, unparsed: d.unparsed.length }; }, withTotal(line));
      t.check(`${name}: the match's net SL and RP are read in full`, r.sl === sl && r.rp === crp, JSON.stringify(r));
      t.check(`${name}: the detail view reads the same total, and the stored text ends at the Total line`, r.dsl === sl && r.dcrp === crp && r.endsWithTotal && r.unparsed === 0, JSON.stringify(r));
    }
  }
  t.check('no uncaught errors while parsing every dataset', page.errs.length === 0, page.errs.join(' | '));
  await page.ctx.close();

  /* ---------- page level: Basic view, then the archive, exports and Advanced view ---------- */
  for (const d of sets.filter(s => s.ui)) {
    const o = d.o;
    t.scope(`invariants › basic › ${d.name}`);
    const p = await newPage(browser);
    await p.goto(base + 'wt-log-analyzer.html');
    await analyze(p, d.text);
    await p.waitForSelector('#matchTable tr');

    const st = await statCells(p);
    t.check('MATCHES counts unique matches only', st['MATCHES'] === String(o.unique.length), `${st['MATCHES']} vs ${o.unique.length}`);
    t.check('WIN RATE matches wins / unique matches', st['WIN RATE'] === o.winRate, `${st['WIN RATE']} vs ${o.winRate}`);
    t.check('TOTAL NET SL is the sum over unique matches', digits(st['TOTAL NET SL']) === String(o.sl), `${st['TOTAL NET SL']} vs ${o.sl}`);
    t.check('TOTAL RP is the sum over unique matches', digits(st['TOTAL RP']) === String(o.rp), `${st['TOTAL RP']} vs ${o.rp}`);

    const rows = await p.$$eval('#matchTable tr', trs => trs.slice(1).map(tr => ({ dupe: tr.classList.contains('dupe'), win: tr.classList.contains('win'), cells: [...tr.cells].map(c => c.textContent.trim()) })));
    t.check('the per-match table has one row per match pasted', rows.length === o.all.length, `${rows.length} vs ${o.all.length}`);
    t.check('exactly the repeated matches are struck through', rows.filter(r => r.dupe).length === o.dupes, `${rows.filter(r => r.dupe).length} vs ${o.dupes}`);
    t.check('struck-through rows are exactly the ones repeating an earlier Session ID', JSON.stringify(rows.map(r => r.dupe)) === JSON.stringify(o.all.map(m => !o.unique.includes(m))));
    t.check('the SL and RP of non-duplicate rows add up to the totals', rows.filter(r => !r.dupe).reduce((a, r) => a + parseInt(digits(r.cells[4]) || 0, 10), 0) === o.sl
      && rows.filter(r => !r.dupe).reduce((a, r) => a + parseInt(digits(r.cells[5]) || 0, 10), 0) === o.rp);
    const warn = { shown: await p.isVisible('#dupeWarn'), text: norm(await p.textContent('#dupeWarn')) };
    t.check('the duplicate warning shows (with the right number) exactly when there are duplicates',
      o.dupes === 0 ? !warn.shown : warn.shown && warn.text.includes(`${o.dupes} duplicate`), JSON.stringify(warn));

    const split = await p.$$eval('#splitTable tr', trs => trs.slice(1).map(tr => [...tr.cells].map(c => c.textContent.trim())));
    t.check('battle-type split: match counts add up to the unique total', split.reduce((a, r) => a + parseInt(r[1], 10), 0) === o.unique.length);
    t.check('battle-type split: wins + losses add up to the unique total, wins to the oracle\'s', split.reduce((a, r) => a + parseInt(r[2].split('/')[0], 10) + parseInt(r[2].split('/')[1], 10), 0) === o.unique.length
      && split.reduce((a, r) => a + parseInt(r[2].split('/')[0], 10), 0) === o.wins);
    t.check('battle-type split: SL and RP add up to the totals', split.reduce((a, r) => a + parseInt(digits(r[4]), 10), 0) === o.sl && split.reduce((a, r) => a + parseInt(digits(r[7]), 10), 0) === o.rp);

    // Analyze again: nothing may change.
    await p.click('#analyzeBtn');
    const st2 = await statCells(p);
    t.check('analysing the same text again changes nothing', JSON.stringify(st2) === JSON.stringify(st));

    // The archive: one record per unique Session ID.
    await p.waitForFunction(n => new RegExp('\\b' + n + ' match').test(document.getElementById('archiveNote').textContent), o.unique.length, { timeout: 60000 }).catch(() => {});
    const note = norm(await p.textContent('#archiveNote'));
    t.check('the archive note reports one stored match per unique Session ID', new RegExp('\\b' + o.unique.length + ' match').test(note), note);
    const stored = await p.evaluate(async () => { const ids = await WtDB.ids(); return { n: ids.length, ids: ids.slice().sort() }; });
    t.check('the archive holds exactly the unique Session IDs', stored.n === o.unique.length && JSON.stringify(stored.ids) === JSON.stringify(o.unique.map(m => m.id).sort()), `${stored.n} vs ${o.unique.length}`);

    // Exports and a round trip.
    const raw = JSON.parse(zlib.gunzipSync((await download(p, '#rawExportBtn')).buf).toString('utf8'));
    t.check('raw export: count and list both equal the unique matches, each with its own text', raw.count === o.unique.length && raw.matches.length === o.unique.length
      && raw.matches.every(m => m.raw.includes(m.id)), `${raw.count}/${raw.matches.length} vs ${o.unique.length}`);
    t.check('raw export: holds exactly the unique Session IDs', JSON.stringify(raw.matches.map(m => m.id).sort()) === JSON.stringify(o.unique.map(m => m.id).sort()));
    await p.click('#minimalToggle');
    const min = JSON.parse((await download(p, '#exportBtn')).buf.toString('utf8'));
    t.check('minimal export: one entry per unique match, no repeats', Array.isArray(min) && min.length === o.unique.length && new Set(min.map(m => m.id)).size === min.length, `${min.length} vs ${o.unique.length}`);
    t.check('minimal export: SL and RP add up to the totals', min.reduce((a, m) => a + m.sl, 0) === o.sl && min.reduce((a, m) => a + m.rp, 0) === o.rp);
    await p.click('#minimalToggle');
    const html = await download(p, '#exportBtn');

    // Fresh page: import the minimal JSON, then the HTML report; both must give back the same figures.
    for (const [label, file] of [['minimal JSON', { name: 'wt-session-data.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(min)) }],
                                 ['HTML report', { name: html.name, mimeType: 'text/html', buffer: html.buf }]]) {
      const q = await newPage(browser);
      await q.goto(base + 'wt-log-analyzer.html');
      await q.setInputFiles('#importFile', file);
      await q.waitForFunction(() => document.getElementById('importNote').textContent.length > 0);
      await q.click('#analyzeBtn');
      const s = await statCells(q);
      t.check(`${label} re-imports to the same matches, win rate and totals`, s['MATCHES'] === String(o.unique.length) && s['WIN RATE'] === o.winRate
        && digits(s['TOTAL NET SL']) === String(o.sl) && digits(s['TOTAL RP']) === String(o.rp), JSON.stringify(s));
      t.check(`${label} import raises no errors`, q.errs.length === 0, q.errs.join(' | '));
      await q.ctx.close();
    }

    // Advanced view reads the same archive.
    t.scope(`invariants › advanced › ${d.name}`);
    await p.goto(base + 'advanced.html');
    await p.waitForSelector('#libTable tr.pick', { timeout: 120000 });
    let lib = await p.$$eval('#libTable tr.pick', trs => trs.map(tr => tr.dataset.id));
    // Long libraries show only the first rows with a "Showing the first N of M. Show all" note: whatever the
    // cap is, M must be the unique count, N must be what is shown, and "Show all" must reveal every match.
    const cap = norm(await p.textContent('#libTableNote')).match(/Showing the first (\d+) of (\d+)/);
    if (cap) {
      t.check('a capped library says how many it has: the unique match count', +cap[2] === o.unique.length && +cap[1] === lib.length && lib.length < o.unique.length, cap[0]);
      await p.click('#showAllRows');
      await p.waitForFunction(n => document.querySelectorAll('#libTable tr.pick').length === n, o.unique.length, { timeout: 60000 }).catch(() => {});
      lib = await p.$$eval('#libTable tr.pick', trs => trs.map(tr => tr.dataset.id));
    }
    t.check('the library lists exactly the unique matches (after "Show all" if it was capped)', lib.length === o.unique.length && JSON.stringify(lib.slice().sort()) === JSON.stringify(o.unique.map(m => m.id).sort()), `${lib.length} vs ${o.unique.length}`);
    t.check('every library row has per-match detail', (await p.$$('#libTable tr.nodetail')).length === 0);
    const libStats = await p.$$eval('#libStats .stat-cell', cs => Object.fromEntries(cs.map(c => [c.querySelector('.lbl').textContent.trim(), c.querySelector('.num').textContent.trim()])));
    t.check('the library stats agree with the oracle (matches, win rate, SL, RP)', libStats['MATCHES'] === String(o.unique.length) && libStats['WIN RATE'] === o.winRate
      && digits(libStats['TOTAL NET SL']) === String(o.sl) && digits(libStats['TOTAL RP']) === String(o.rp), JSON.stringify(libStats));
    // Open the first and last row: detail must show that match's Session ID.
    for (const id of [lib[0], lib[lib.length - 1]]) {
      await p.click(`#libTable tr.pick[data-id="${id}"]`);
      await p.waitForFunction(i => { const h = document.querySelector('#detailBody .detail-head'); return h && h.textContent.includes(i); }, id, { timeout: 30000 }).catch(() => {});
      t.check(`opening match ${id.slice(0, 6)}… shows its own detail`, norm(await p.textContent('#detailBody .detail-head').catch(() => '')).includes(id));
    }
    t.check('no uncaught errors in either view', p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();
  }

  /* ---------- relationships between datasets ---------- */
  t.scope('invariants › relationships');
  const by = Object.fromEntries(sets.map(s => [s.name, s.o]));
  const dbl = by['a log pasted twice (every match duplicated)'], rev = by['blocks in reverse order'], std = by['matches.txt'];
  if (dbl) t.check('pasting a log twice doubles the matches pasted but not the unique ones', dbl.all.length === 2 * dbl.unique.length && dbl.dupes === dbl.unique.length);
  if (rev && std) t.check('reversing the order of the blocks does not change any total', rev.unique.length === std.unique.length && rev.sl === std.sl && rev.rp === std.rp && rev.wins === std.wins);
  const one = by['one match pasted 50 times'];
  if (one) t.check('one match pasted 50 times counts as one', one.unique.length === 1 && one.dupes === 49);
};
