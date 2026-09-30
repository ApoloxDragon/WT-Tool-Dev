/* Advanced view suite: library, filters, match detail, insights, storage panel, raw round trips. */
const fs = require('fs'), zlib = require('zlib');
const { newPage, norm, sha } = require('../harness');
const { EX, exampleLog, gz, rawExportOf, splitBlocks } = require('../fixtures');

async function seeded(browser, base) {           // a context whose archive holds the example matches
  const p = await newPage(browser);
  await p.goto(base + 'wt-log-analyzer.html');
  await p.click('#loadExampleBtn');
  await p.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent));
  await p.goto(base + 'advanced.html');
  await p.waitForSelector('#libTable tr.pick');
  return p;
}

exports.run = async ({ browser, base, t }) => {
  const page = await seeded(browser, base);
  const T = sel => page.textContent(sel).then(norm);

  t.scope('advanced › library');
  t.check('lists the 67 archived matches, all with detail', (await page.$$('#libTable tr.pick')).length === 67 && (await page.$$('#libTable tr.nodetail')).length === 0);
  t.snapshot('library stats', await T('#libStats'));
  const rows = await page.$$eval('#libTable tr.pick', trs => trs.map(tr => tr.dataset.id + '|' + [...tr.cells].map(c => c.textContent.trim()).join('|')));
  t.snapshot('library rows (newest first)', rows, Object.fromEntries(rows.map(r => [r.split('|')[0], r])));
  const cats = await page.$$eval('#fCategory option', o => o.map(x => x.textContent));
  t.snapshot('category filter options', cats.join(','));

  t.scope('advanced › filters');
  const count = () => page.$$eval('#libTable tr.pick', r => r.length);
  await page.selectOption('#fResult', 'Victory'); t.snapshot('Victory-only filter count', String(await count())); await page.selectOption('#fResult', '');
  await page.fill('#fSearch', 'sinai'); await page.waitForTimeout(400); t.snapshot('search "sinai" count', String(await count())); await page.fill('#fSearch', '');
  await page.waitForTimeout(400);
  await page.selectOption('#fSort', 'sl'); const top = await page.$eval('#libTable tr.pick', r => r.cells[4].textContent);
  t.check('sort by SL puts the biggest payout first', top.replace(/,/g, '') === String(Math.max(...rows.map(r => +r.split('|')[5].replace(/,/g, '')))), top);
  await page.selectOption('#fSort', 'new');
  await page.fill('#fSearch', 'no-such-mission'); await page.waitForTimeout(400);
  t.check('a search with no hits shows an empty-state row', /No matches fit/.test(await T('#libTable')));
  await page.fill('#fSearch', ''); await page.waitForTimeout(400);

  t.scope('advanced › match detail');
  const ids = rows.map(r => r.split('|')[0]);
  const pick = [ids[0], ids[10], ids[30], ids[55], ids[66]];
  const details = {};
  for (const id of pick) {
    await page.click(`#libTable tr.pick[data-id="${id}"]`);
    await page.waitForFunction(id => { const h = document.querySelector('#detailBody .detail-head'); return h && h.textContent.includes(id); }, id);
    await page.waitForSelector('#detailBody .stat-row');
    await page.evaluate(() => document.querySelectorAll('#detailBody details').forEach(d => d.open = true));
    details[id] = norm(await page.textContent('#detailBody'));
  }
  t.snapshot('detail panel text for 5 sample matches', pick.map(i => details[i]), details);
  t.check('detail panel shows vehicles, events and raw text', Object.values(details).every(d => /Vehicles/.test(d) && /Events/.test(d) && /Raw log text/.test(d)));
  await page.keyboard.press('Escape');
  t.check('Esc closes the detail panel', !(await page.isVisible('#detailSection')));

  t.scope('advanced › insights');
  t.snapshot('by-map table', await T('#mapTable'));
  await page.evaluate(() => document.querySelectorAll('#insightsSection details').forEach(d => d.open = true));
  await page.waitForFunction(() => document.querySelectorAll('#vehicleTable tr').length > 1 && document.querySelectorAll('#eventTable tr').length > 1);
  t.snapshot('by-vehicle table', await T('#vehicleTable'));
  t.snapshot('earnings-by-event-type table', await T('#eventTable'));

  t.scope('advanced › storage panel');
  t.snapshot('storage tiles (counts only)', (await T('#storageStats')).replace(/[\d.,]+ (B|KB|MB)/g, 'SIZE').replace(/SIZE \/ SIZE/, 'USAGE'));
  async function dl(sel) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); return { name: d.suggestedFilename(), buf: fs.readFileSync(await d.path()) }; }
  const g = await dl('#exportRawGz'); const gj = JSON.parse(zlib.gunzipSync(g.buf).toString());
  t.check('raw export .json.gz: valid, 67 matches', gj.format === 'wt-raw-export' && gj.count === 67 && /\.json\.gz$/.test(g.name));
  const pj = await dl('#exportRawJson'); t.check('raw export .json: valid, same matches', JSON.parse(pj.buf.toString()).count === 67 && /\.json$/.test(pj.name));
  t.check('backup status says everything is backed up after export', /everything is backed up/.test(await T('#storageNote')));
  t.snapshot('raw export matches (advanced view)', gj.matches.map(m => m.raw), Object.fromEntries(gj.matches.map(m => [m.id, m.raw])));

  t.scope('advanced › raw round trips');
  await page.click('#deleteArchiveBtn'); await page.waitForSelector('#libEmpty', { state: 'visible' });
  t.check('delete-all empties the archive and shows the empty state', await page.isVisible('#libEmpty'));
  await page.setInputFiles('#importRawFile', { name: 'x.json.gz', mimeType: 'application/gzip', buffer: g.buf });
  await page.waitForSelector('#libTable tr.pick');
  t.check('re-importing the .json.gz restores all 67', (await count()) === 67);
  await page.setInputFiles('#importRawFile', { name: 'x.json', mimeType: 'application/json', buffer: pj.buf });
  await page.waitForFunction(() => /already archived/.test(document.getElementById('storageMsg').textContent));
  t.check('re-importing is idempotent (67 already archived)', /67 already archived/.test(await T('#storageMsg')), await T('#storageMsg'));
  await page.click('#deleteArchiveBtn'); await page.waitForSelector('#libEmpty', { state: 'visible' });
  await page.setInputFiles('#importRawFile', EX('matches.txt'));
  await page.waitForSelector('#libTable tr.pick');
  t.check('importing the plain .txt log fills the archive', (await count()) === 67);
  await page.click('#libTable tr.pick >> nth=0'); await page.click('#deleteOneBtn');
  await page.waitForFunction(() => document.querySelectorAll('#libTable tr.pick').length === 66);
  t.check('deleting a single match leaves 66', (await count()) === 66);
  t.check('no uncaught errors during the advanced-view session', page.errs.length === 0, page.errs.join(' | '));

  t.scope('advanced › older archive records');
  { const p = await newPage(browser); await p.goto(base + 'wt-log-analyzer.html');
    const blocks = splitBlocks(exampleLog()).slice(0, 5);
    // put() with no summary = the shape of a record written by an older build
    await p.evaluate(async b => { await WtDB.clear(); for (let i = 0; i < b.length; i++) { const id = (b[i].match(/Session:\s*([a-f0-9]+)/) || [])[1]; await WtDB.put(id, b[i]); } }, blocks);
    await p.goto(base + 'advanced.html'); await p.waitForSelector('#libTable tr.pick');
    t.check('records stored without a summary are still listed, with full detail', (await p.$$('#libTable tr.pick')).length === 5 && (await p.$$('#libTable tr.nodetail')).length === 0);
    await p.click('#libTable tr.pick >> nth=0'); await p.waitForSelector('#detailBody .stat-row');
    t.check('…and open in detail', /Vehicles/.test(await p.textContent('#detailBody')));
    await p.waitForTimeout(500);
    const upgraded = await p.evaluate(async () => { try { return (await WtDB.meta()).every(m => m.sum && m.sum.pv >= 1); } catch (e) { return false; } });
    t.check('…and their summaries are saved, so the next visit needn\'t read the raw text', upgraded);
    await p.ctx.close(); }

  t.scope('advanced › opening does not unpack the archive');
  { const q = await newPage(browser, { init: { fn: () => { window.__unpacks = 0; const Orig = window.DecompressionStream; window.DecompressionStream = function (f) { window.__unpacks++; return new Orig(f); }; } } });
    // fill the archive the normal way (Analyze writes each record WITH its summary), then count gunzip calls
    await q.goto(base + 'wt-log-analyzer.html'); await q.click('#loadExampleBtn');
    await q.waitForFunction(() => /67 match/.test(document.getElementById('archiveNote').textContent));
    await q.evaluate(() => { window.__unpacks = 0; });
    await q.goto(base + 'advanced.html'); await q.waitForSelector('#libTable tr.pick');
    t.check('opening the library (67 matches) decompresses nothing', (await q.evaluate(() => window.__unpacks)) === 0, String(await q.evaluate(() => window.__unpacks)));
    await q.ctx.close(); }

  t.scope('advanced › summary-only matches');
  const s = await newPage(browser); await s.goto(base + 'wt-log-analyzer.html');
  await s.setInputFiles('#importFile', EX('wt-session-data.json')); await s.waitForFunction(() => /Imported/.test(document.getElementById('importNote').textContent));
  await s.goto(base + 'advanced.html'); await s.waitForSelector('#libTable tr.pick');
  t.check('summary-only matches are listed and flagged as having no detail', (await s.$$('#libTable tr.nodetail')).length === 67);
  await s.click('#libTable tr.pick >> nth=0');
  t.check('opening one explains that no detail is stored', /No detail stored/.test(await s.textContent('#detailBody')));
  await s.ctx.close(); await page.ctx.close();
};
