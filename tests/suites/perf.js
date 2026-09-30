/* Performance suite: timings on synthetic logs built from the real example matches. */
const { newPage } = require('../harness');
const { syntheticLog } = require('../fixtures');

exports.run = async ({ browser, base, t, scale }) => {
  const sizes = scale === 'small' ? [200, 1000] : [200, 2000, 6000];
  for (const n of sizes) {
    const log = syntheticLog(n);
    t.scope(`perf › ${n} matches`);
    const page = await newPage(browser);
    await page.goto(base + 'wt-log-analyzer.html');

    const parsed = await page.evaluate(src => { const t0 = performance.now(); const ms = parseLog(src); const ms1 = performance.now() - t0; return { ms: ms1, n: ms.length, unique: new Set(ms.map(m => m.sessionId)).size }; }, log);
    t.check(`synthetic log parses to ${n} unique matches`, parsed.n === n && parsed.unique === n, JSON.stringify(parsed));
    t.metric('parse the pasted log', parsed.ms);

    const detailMs = await page.evaluate(src => { const ms = parseLog(src); const t0 = performance.now(); ms.forEach(m => parseDetail(m.raw)); return performance.now() - t0; }, log);
    t.metric('parse per-match detail for all matches', detailMs);

    const arch = await page.evaluate(async src => { const ms = parseLog(src); const t0 = performance.now(); const r = await archiveParsedMatches(ms); return { ms: performance.now() - t0, r, count: (await WtDB.ids()).length }; }, log);
    t.check('archive write stores every match', arch.count === n && arch.r.added === n, JSON.stringify(arch.r) + ' stored=' + arch.count);
    t.metric('write all matches to the archive', arch.ms);

    t.metric('read + decompress the whole archive', await page.evaluate(async () => { const t0 = performance.now(); const all = await WtDB.all(); return all.length ? performance.now() - t0 : -1; }));
    t.metric('archive stats()', await page.evaluate(async () => { const t0 = performance.now(); await WtDB.stats(); return performance.now() - t0; }));

    const an = await page.evaluate(src => { document.getElementById('input').value = src; const t0 = performance.now(); analyze(); return performance.now() - t0; }, log);
    t.metric('Analyze click (stats + every table)', an);
    t.check('Analyze renders one row per match', await page.$$eval('#matchTable tr', r => r.length) === n + 1);
    await page.waitForFunction(len => /match/.test(document.getElementById('archiveNote').textContent), null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(300);

    const t1 = Date.now();
    await page.goto(base + 'advanced.html');
    await page.waitForSelector('#libTable tr.pick', { timeout: 120000 });
    t.metric('Advanced: open page until first library row shows', Date.now() - t1);
    await page.evaluate(() => document.querySelectorAll('#insightsSection details').forEach(d => d.open = true));
    await page.waitForFunction(() => document.querySelectorAll('#vehicleTable tr').length > 1 && document.querySelectorAll('#eventTable tr').length > 1, null, { timeout: 120000 });
    t.metric('Advanced: open page and have every insight table filled', Date.now() - t1);

    t.metric('Advanced: re-render library after a filter change', await page.evaluate(() => { const t0 = performance.now(); renderLibrary(); return performance.now() - t0; }));
    t.metric('Advanced: open one match detail', await page.evaluate(() => { const id = library[Math.floor(library.length / 2)].m.sessionId; const t0 = performance.now(); selectMatch(id); return performance.now() - t0; }));
    t.check('no uncaught errors at this size', page.errs.length === 0, page.errs.join(' | '));
    await page.ctx.close();
  }
};
