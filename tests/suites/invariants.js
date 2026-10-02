/* Size-agnostic suite: no check here names a match count. Every expected figure is derived from the
 * log being tested by an independent oracle (fixtures.oracle) and compared with what the app produces,
 * so the same checks hold for 1 match, 84, 216 or 1,001 — and for any example file added later.
 * Parser-level checks run on every dataset; the page-level ones (Analyze, archive, exports, Advanced)
 * run on those marked `ui` in fixtures.datasets(). */
const fs = require('fs'), zlib = require('zlib');
const { newPage, norm } = require('../harness');
const { oracle, datasets, splitBlocks, exampleLog } = require('../fixtures');

const digits = s => String(s).replace(/[^\d-]/g, '');
// The Basic per-match table shows a first batch of rows; reveal the rest (a no-op for small sessions).
const showAllRows = page => page.evaluate(() => { if (typeof expandAllMatchRows === 'function') expandAllMatchRows(); });
const ROWS_FIRST = 200; // MATCH_ROWS_FIRST in main.js
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
  const adv = await newPage(browser);
  await adv.goto(base + 'advanced.html');
  for (const d of sets) {
    const o = d.o;
    t.scope(`invariants › parser › ${d.name}`);
    const r = await page.evaluate(src => {
      const ms = parseLog(src);
      return {
        n: ms.length, ids: ms.map(m => m.sessionId), results: ms.map(m => m.result), netSL: ms.map(m => m.netSL), rp: ms.map(m => m.totalRP),
        fields: ms.map(m => ({ mode: m.mode, mission: m.mission, timeSec: m.timeSec,
          researched: m.researched.map(x => ({ name: x.name, rp: x.rp })), researching: m.researching.map(x => ({ name: x.name, rp: x.rp })) })),
        rawOk: ms.every(m => m.raw && m.raw.startsWith(m.result + ' in the [') && m.raw.includes(m.sessionId)),
        rawCoversInput: ms.map(m => m.raw).join('').replace(/\s/g, '').length <= src.replace(/\s/g, '').length,
        detail: ms.map(m => { const dt = parseDetail(m.raw); return { unparsed: dt.unparsed.length, events: dt.sections.reduce((a, s) => a + s.events.length, 0), session: dt.sessionId, hasTotal: !!dt.total, researched: dt.researched.map(x => ({ name: x.name, rp: x.rp })), researching: dt.researching.map(x => ({ name: x.name, rp: x.rp })) }; }),
        lf: JSON.stringify(parseLog(src.replace(/\r\n/g, '\n')).map(m => ({ ...m, raw: undefined }))),
        crlf: JSON.stringify(parseLog(src.replace(/\r?\n/g, '\r\n')).map(m => ({ ...m, raw: undefined })))
      };
    }, d.text);
    t.check('finds exactly as many matches as there are headers in the text', r.n === o.all.length, `${r.n} vs ${o.all.length}`);
    t.check('matches come back in the order they appear, with the right Session IDs', JSON.stringify(r.ids) === JSON.stringify(o.all.map(m => m.id)));
    t.check('every result (Victory/Defeat) agrees', JSON.stringify(r.results) === JSON.stringify(o.all.map(m => m.result)));
    t.check('every match\'s net SL and RP agree with its Total: line', JSON.stringify(r.netSL) === JSON.stringify(o.all.map(m => m.sl)) && JSON.stringify(r.rp) === JSON.stringify(o.all.map(m => m.rp)));
    // Field by field, naming the first mismatch, so a silent misread of one match is pinned to that match.
    const firstDiff = pick => { const i = r.fields.findIndex((f, k) => JSON.stringify(pick(f)) !== JSON.stringify(pick(o.all[k]))); return i < 0 ? '' : `match #${i} (${o.all[i].id}): got ${JSON.stringify(pick(r.fields[i]))}, expected ${JSON.stringify(pick(o.all[i]))}`; };
    t.check('every match\'s game mode and mission agree with its header', !firstDiff(f => [f.mode, f.mission]), firstDiff(f => [f.mode, f.mission]));
    t.check('every match\'s time played agrees with its Time Played line', !firstDiff(f => f.timeSec), firstDiff(f => f.timeSec));
    t.check('every match\'s research targets ("Researched unit") agree, name by name', !firstDiff(f => f.researched), firstDiff(f => f.researched));
    t.check('every match\'s module progress ("Researching progress") agrees, name by name', !firstDiff(f => f.researching), firstDiff(f => f.researching));
    const dDiff = r.detail.findIndex((x, k) => JSON.stringify(x.researched) !== JSON.stringify(r.fields[k].researched) || JSON.stringify(x.researching) !== JSON.stringify(r.fields[k].researching));
    t.check('the detail view lists the same research targets and module progress as the summary, match by match', dDiff < 0, dDiff < 0 ? '' : `match #${dDiff}: detail ${JSON.stringify(r.detail[dDiff].researched)} vs summary ${JSON.stringify(r.fields[dDiff].researched)}`);
    t.check('each match keeps its own raw text, and no text is invented', r.rawOk && r.rawCoversInput);
    t.check('detail parsing leaves no line unrecognised', r.detail.every(x => x.unparsed === 0), r.detail.filter(x => x.unparsed).length + ' matches');
    t.check('detail parsing finds one event per indented line, in every match', r.detail.every((x, i) => x.events === o.all[i].events), r.detail.filter((x, i) => x.events !== o.all[i].events).length + ' differ');
    const badDetail = r.detail.map((x, i) => ({ i, id: o.all[i].id, got: x.session, hasTotal: x.hasTotal })).filter(x => x.got !== x.id || !x.hasTotal);
    t.check('detail parsing reads the same Session ID and a total in every match', badDetail.length === 0, badDetail.length + ' bad, first: ' + JSON.stringify(badDetail[0]));
    t.check('CRLF and LF versions of the log parse identically', r.lf === r.crlf);
    // dedupeLogText belongs to the Advanced view (its Storage panel), so it is exercised on that page.
    const dd = await adv.evaluate(src => {
      const lf = src.replace(/\r\n/g, '\n'), a = dedupeLogText(src), b = dedupeLogText(a.text), after = parseLog(a.text);
      const first = lf.search(/^(Victory|Defeat) in the \[/m);
      return { removed: a.removed, ids: after.map(m => m.sessionId), sl: after.reduce((s, m) => s + m.netSL, 0), rp: after.reduce((s, m) => s + m.totalRP, 0),
        againRemoved: b.removed, againSame: b.text === a.text, prefixKept: first < 0 || a.text.startsWith(lf.slice(0, first)) };
    }, d.text);
    t.check('dedupeLogText removes exactly the repeated matches', dd.removed === o.dupes, `${dd.removed} vs ${o.dupes}`);
    t.check('after dedupeLogText the log holds exactly the unique matches, first copies, in order', JSON.stringify(dd.ids) === JSON.stringify(o.unique.map(m => m.id)));
    t.check('dedupeLogText leaves the totals unchanged', dd.sl === o.sl && dd.rp === o.rp, `${dd.sl}/${dd.rp} vs ${o.sl}/${o.rp}`);
    t.check('dedupeLogText is idempotent and keeps any text before the first match', dd.againRemoved === 0 && dd.againSame && dd.prefixKept);
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
  // A finished vehicle's line can add RP banked toward it in earlier battles; that is real progress on the target.
  t.scope('invariants › parser › research line with "earned in the previous battles"');
  {
    const withLine = line => splitBlocks(exampleLog())[0].replace(/^Researched unit:[^\n]*\n[^\n]*\n/m, 'Researched unit: \n' + line + '\n');
    const cases = {
      'one vehicle, plus RP from earlier battles': ['EMBT(Germany): 5016 RP + earned in the previous battles: 15474 RP', [{ name: 'EMBT(Germany)', rp: 20490 }]],
      'with thousands separators': ['EMBT(Germany): 5,016 RP + earned in the previous battles: 15,474 RP', [{ name: 'EMBT(Germany)', rp: 20490 }]],
      'a plain line is unchanged': ['EMBT(Germany): 5016 RP', [{ name: 'EMBT(Germany)', rp: 5016 }]]
    };
    for (const [name, [line, want]] of Object.entries(cases)) {
      const r = await page.evaluate(s => { const [m] = parseLog(s); const d = parseDetail(m.raw); return { target: m.researched, detail: d.researched, unparsed: d.unparsed.length }; }, withLine(line));
      t.check(`${name}: one target row with the combined RP (no "earned in the previous battles" target)`, JSON.stringify(r.target) === JSON.stringify(want), JSON.stringify(r.target));
      t.check(`${name}: the detail view agrees, and leaves no line unrecognised`, JSON.stringify(r.detail) === JSON.stringify(want) && r.unparsed === 0, JSON.stringify(r));
    }
  }
  t.check('no uncaught errors while parsing every dataset', page.errs.length === 0 && adv.errs.length === 0, page.errs.concat(adv.errs).join(' | '));
  await page.ctx.close(); await adv.ctx.close();

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

    const firstBatch = (await p.$$('#matchTable tr')).length - 1;
    t.check('the table starts with at most the first batch of rows, and says how many more there are', firstBatch === Math.min(o.all.length, ROWS_FIRST)
      && (o.all.length <= ROWS_FIRST ? (await p.textContent('#matchTableMore')) === '' : new RegExp(`Showing the first ${ROWS_FIRST} of ${o.all.length.toLocaleString('en-US')} matches`).test(await p.textContent('#matchTableMore'))), `${firstBatch} rows`);
    await showAllRows(p);
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

    /* ---- Advanced > Storage > "Clear duplicate matches", each time on a fresh browser profile ---- */
    t.scope(`invariants › duplicates › ${d.name}`);
    const KEY = 'wtSessionReadout.';
    const savedText = pg => pg.evaluate(k => { try { return JSON.parse(localStorage.getItem(k + 'inputText') || '""'); } catch (e) { return ''; } }, KEY);
    const clickDedupe = async pg => {
      await pg.evaluate(() => { document.getElementById('storageMsg').textContent = ''; });
      await pg.click('#dedupeBtn');
      await pg.waitForFunction(() => document.getElementById('storageMsg').textContent.length > 0, null, { timeout: 30000 });
      return norm(await pg.textContent('#storageMsg'));
    };
    const backInBasic = async (pg, label) => {
      await pg.goto(base + 'wt-log-analyzer.html');
      await pg.waitForSelector('#matchTable tr');
      await showAllRows(pg);
      const s = await statCells(pg);
      t.check(`${label}: the Basic view shows the same matches, win rate and totals`, s['MATCHES'] === String(o.unique.length) && s['WIN RATE'] === o.winRate
        && digits(s['TOTAL NET SL']) === String(o.sl) && digits(s['TOTAL RP']) === String(o.rp), JSON.stringify(s));
      t.check(`${label}: no duplicate warning and no struck-through rows`, !(await pg.isVisible('#dupeWarn')) && (await pg.$$('#matchTable tr.dupe')).length === 0);
      t.check(`${label}: one row per unique match`, (await pg.$$('#matchTable tr')).length - 1 === o.unique.length);
    };
    const prepare = async () => {
      const pg = await newPage(browser);
      await pg.goto(base + 'wt-log-analyzer.html');
      await analyze(pg, d.text);
      await pg.waitForSelector('#matchTable tr');
      const saved = await pg.waitForFunction(k => localStorage.getItem(k + 'inputText') !== null, KEY, { timeout: 5000 }).then(() => true).catch(() => false);
      await pg.waitForFunction(n => new RegExp('\\b' + n + ' match').test(document.getElementById('archiveNote').textContent), o.unique.length, { timeout: 60000 }).catch(() => {});
      return { pg, saved };
    };

    // A) saved session text only
    { const { pg, saved } = await prepare();
      if (!saved) { console.log(`  skip  duplicates › ${d.name}: this log is too big for the browser to save as a session, so there is nothing to clean`); }
      else {
        await pg.goto(base + 'advanced.html'); await pg.waitForSelector('#dedupeBtn');
        const msg1 = await clickDedupe(pg);
        t.check('the saved session: the button reports exactly the number of repeated matches (or none)', o.dupes ? msg1.includes(`Deleted ${o.dupes} duplicate`) : /No duplicate matches found/.test(msg1), msg1);
        const after = oracle(await savedText(pg));
        t.check('the saved session now holds exactly the unique matches, first copies, in order', after.dupes === 0 && JSON.stringify(after.all.map(m => m.id)) === JSON.stringify(o.unique.map(m => m.id)));
        t.check('each kept match is its original text, untouched', JSON.stringify(after.all.map(m => m.raw)) === JSON.stringify(o.unique.map(m => m.raw)));
        t.check('the archive is untouched', (await pg.evaluate(async () => (await WtDB.ids()).length)) === o.unique.length);
        const msg2 = await clickDedupe(pg);
        t.check('a second run finds nothing more', /No duplicate matches found/.test(msg2), msg2);
        await backInBasic(pg, 'after cleaning the saved session');
        t.check('no uncaught errors', pg.errs.length === 0, pg.errs.join(' | '));
      }
      await pg.ctx.close(); }

    // B) the same matches also imported as summaries (every imported match is a repeat of one in the saved text)
    { const { pg, saved } = await prepare();
      if (saved) {
        await pg.setInputFiles('#importFile', { name: 'wt-session-data.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(min)) });
        await pg.waitForFunction(() => document.getElementById('importNote').textContent.length > 0);
        await pg.waitForFunction(k => localStorage.getItem(k + 'importedMatches') !== null, KEY, { timeout: 10000 }).catch(() => {});
        await pg.goto(base + 'advanced.html'); await pg.waitForSelector('#dedupeBtn');
        const msg = await clickDedupe(pg);
        const expected = o.dupes + o.unique.length;
        t.check('with imported copies too: the button reports the repeats in the text plus every imported copy', msg.includes(`Deleted ${expected} duplicate`), msg);
        const imported = await pg.evaluate(k => JSON.parse(localStorage.getItem(k + 'importedMatches') || '[]'), KEY);
        t.check('no imported copies are left, and the saved text holds each match once', imported.length === 0 && oracle(await savedText(pg)).dupes === 0 && oracle(await savedText(pg)).all.length === o.unique.length);
        await backInBasic(pg, 'after cleaning imported copies too');
        t.check('no uncaught errors (imported case)', pg.errs.length === 0, pg.errs.join(' | '));
      }
      await pg.ctx.close(); }
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
