/* Storage suite: the compressed raw archive (WtDB) and its fallbacks. */
const { newPage, withDeadline } = require('../harness');
const { exampleLog, splitBlocks } = require('../fixtures');

exports.run = async ({ browser, base, t }) => {
  const blocks = splitBlocks(exampleLog());
  const page = await newPage(browser);
  await page.goto(base + 'wt-log-analyzer.html');

  t.scope('storage › archive basics');
  const r = await page.evaluate(async (blocks) => {
    const out = {};
    out.backend = await WtDB.backendName();
    out.putOk = await WtDB.put('aaa111', blocks[0]);
    out.get = (await WtDB.get('aaa111')) === blocks[0];
    const uni = 'Zürich ÀÉÎ — 日本語 🚀\n' + 'x'.repeat(100000);
    await WtDB.put('uni1', uni); out.unicode = (await WtDB.get('uni1')) === uni;
    out.putEmpty = await WtDB.put('empty1', '');
    out.putNoId = await WtDB.put('', 'abc');
    out.missing = await WtDB.get('nope');
    await WtDB.put('aaa111', blocks[1]); out.overwrite = (await WtDB.get('aaa111')) === blocks[1];
    out.ids = (await WtDB.ids()).sort();
    out.all = (await WtDB.all()).length;
    await WtDB.remove('uni1'); out.afterRemove = (await WtDB.ids()).length;
    await WtDB.clear(); out.afterClear = (await WtDB.ids()).length;
    // compression on real data
    for (let i = 0; i < blocks.length; i++) await WtDB.put('id' + i.toString().padStart(3, '0'), blocks[i]);
    const st = await WtDB.stats(); out.stats = { count: st.count, raw: st.rawBytes, stored: st.storedBytes, ok: st.rawBytes > 0 && st.storedBytes > 0 };
    out.ratio = st.rawBytes / st.storedBytes;
    return out;
  }, blocks);
  t.check('uses IndexedDB in a normal browser', r.backend === 'idb', r.backend);
  t.check('put/get round-trips a real match block exactly', r.putOk === true && r.get);
  t.check('unicode + 100 KB text round-trips exactly', r.unicode);
  t.check('rejects an empty block and an empty id (returns false, no throw)', r.putEmpty === false && r.putNoId === false);
  t.check('get of an unknown id returns null', r.missing === null);
  t.check('put on an existing id overwrites', r.overwrite);
  t.check('ids() and all() list what was stored', r.ids.join() === 'aaa111,uni1' && r.all === 2, r.ids.join());
  t.check('remove() and clear() work', r.afterRemove === 1 && r.afterClear === 0);
  t.check('stats() reports count and sizes for 84 blocks', r.stats.count === 84 && r.stats.ok, JSON.stringify(r.stats));
  t.check('real match blocks compress by at least 2×', r.ratio >= 2, r.ratio.toFixed(2) + '×');
  t.snapshot('raw bytes stored for the 84 example blocks', String(r.stats.raw));

  t.scope('storage › corrupt data');
  const c = await page.evaluate(async (blocks) => {
    await WtDB.clear();
    await WtDB.put('a1', blocks[0]); await WtDB.put('c3', blocks[1]);
    // slip a damaged record in between the two good ones (IndexedDB returns keys in order)
    await new Promise((res, rej) => {
      const req = indexedDB.open('wtSessionReadout-dev', 1);
      req.onsuccess = () => { const tx = req.result.transaction('raw', 'readwrite'); tx.objectStore('raw').put({ id: 'b2', enc: 'gzip', data: new Uint8Array([1, 2, 3, 4]), size: 10 }); tx.oncomplete = () => { req.result.close(); res(); }; };
      req.onerror = () => rej(req.error);
    });
    const out = {};
    try { out.bad = await WtDB.get('b2'); out.getThrew = false; } catch (e) { out.getThrew = true; }
    try { out.all = (await WtDB.all()).map(x => x.id); out.allThrew = false; } catch (e) { out.allThrew = true; }
    out.stats = !!(await WtDB.stats());
    return out;
  }, blocks);
  t.check('get() on a damaged record returns null instead of throwing', c.getThrew === false && c.bad === null);
  t.check('all() skips a damaged record and still returns the good ones after it', !c.allThrew && c.all && c.all.join() === 'a1,c3', c.all ? c.all.join() : 'threw');
  t.check('stats() still works with a damaged record present', c.stats);
  await page.ctx.close();

  t.scope('storage › fallbacks');
  let p = await newPage(browser, { init: { fn: () => Object.defineProperty(window, 'indexedDB', { value: undefined }) } });
  await p.goto(base + 'wt-log-analyzer.html');
  const f = await p.evaluate(async (b0) => ({ be: await WtDB.backendName(), put: await WtDB.put('abc123', b0), got: (await WtDB.get('abc123')) === b0, ids: await WtDB.ids() }), blocks[0]);
  t.check('without IndexedDB it falls back to localStorage and round-trips', f.be === 'ls' && f.put && f.got && f.ids.join() === 'abc123', JSON.stringify({ be: f.be, put: f.put, got: f.got }));
  await p.ctx.close();
  p = await newPage(browser, { init: { fn: () => { Object.defineProperty(window, 'indexedDB', { value: undefined }); Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } } });
  await p.goto(base + 'wt-log-analyzer.html');
  const n = await p.evaluate(async (b0) => { try { return { be: await WtDB.backendName(), put: await WtDB.put('abc123', b0), get: await WtDB.get('abc123'), ids: await WtDB.ids() }; } catch (e) { return { threw: e.message }; } }, blocks[0]);
  t.check('with no storage at all it reports "none" and never throws', n.be === 'none' && n.put === false && n.get === null && !n.threw, JSON.stringify(n));
  t.check('the page still loads and analyzes with no storage available', await (async () => { try { await p.click('#loadExampleBtn'); await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1, null, { timeout: 8000 }); return true; } catch (e) { return false; } })(), p.errs.join(' | '));
  await p.ctx.close();
};
