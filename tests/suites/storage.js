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

  /* ---------------- the compression worker and its fallbacks ---------------- */
  const countOps = () => { window.__ops = []; window.__gunzips = 0;
  const post = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, t) { if (m && m.op) window.__ops.push(m.op); return post.call(this, m, t); };
  const OD = window.DecompressionStream; window.DecompressionStream = function (f) { window.__gunzips++; return new OD(f); }; };
  const many = splitBlocks(exampleLog()).map((b, i) => ({ id: 'w' + String(i).padStart(4, '0'), text: b }));
  const roundTrip = async p => p.evaluate(async items => {
    const stored = await WtDB.putMany(items.map(i => ({ id: i.id, text: i.text })));
    const back = await WtDB.all();
    const one = await WtDB.get(items[3].id);
    const ins = await WtDB.insightsFromTexts(items.slice(0, 5).map(i => i.text));
    return { stored, same: back.length === items.length && items.every(i => back.find(b => b.id === i.id).text === i.text), one: one === items[3].text, ins: ins.length === 5 && ins.every(x => x && x.v === 1 && Array.isArray(x.veh)), ops: window.__ops ? window.__ops.slice() : [], worker: WtWorker.available() };
  }, many);

  t.scope('storage › worker');
  let wp = await newPage(browser, { init: { fn: countOps } }); await wp.goto(base + 'wt-log-analyzer.html');
  const w1 = await roundTrip(wp);
  t.check('with the worker: 84 matches are stored, read back exactly, and rollups are produced', w1.stored === 84 && w1.same && w1.one && w1.ins, JSON.stringify({ stored: w1.stored, same: w1.same, one: w1.one, ins: w1.ins }));
  t.check('…and the heavy work really ran in the worker (pack, unpack and insights messages)', ['pack', 'unpack', 'insights'].every(o => w1.ops.includes(o)), w1.ops.join());
  t.check('…and the main thread decompressed only the one match fetched singly with get() (bulk reads all went through the worker)', (await wp.evaluate(() => window.__gunzips)) === 1, String(await wp.evaluate(() => window.__gunzips)));
  await wp.ctx.close();

  t.scope('storage › worker unavailable (fallbacks)');
  const fallbacks = {
    'the browser has no Worker': { init: { fn: () => { window.Worker = undefined; } } },
    'the worker file fails to load': { route: r => r.abort() },
    'the worker file never arrives (stalled; call gives up after 1.5 s)': { route: async r => { await new Promise(res => setTimeout(res, 7000)); try { await r.abort(); } catch (e) { /* closed */ } }, timeout: 1500 },
    'the worker file is broken (syntax error)': { route: r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'importScripts(' }) }
  };
  for (const [why, f] of Object.entries(fallbacks)) {
    const p = await newPage(browser, f.init ? { init: f.init } : {});
    if (f.route) await p.route('**/javascript/archive-worker.js', f.route);
    await p.goto(base + 'wt-log-analyzer.html');
    if (f.timeout) await p.evaluate(ms => { WtWorker.timeoutMs = ms; }, f.timeout);
    const t0 = Date.now(), r = await roundTrip(p), took = Date.now() - t0;
    t.check(`${why}: saving, reading and rollups still work and are exact`, r.stored === 84 && r.same && r.one && r.ins, JSON.stringify({ stored: r.stored, same: r.same, one: r.one, ins: r.ins }));
    if (f.timeout) t.check(`${why}: …without waiting around (done in ${Math.round(took / 1000)} s, well before the 7 s stall ends)`, took < 6500, took + ' ms');
    t.check(`${why}: …and no uncaught errors`, p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();
  }

  t.scope('storage › insight rollups');
  const q = await newPage(browser); await q.goto(base + 'wt-log-analyzer.html');
  const chk = await q.evaluate(async items => {
    const texts = items.map(i => i.text);
    const rolled = await WtDB.insightsFromTexts(texts);
    const clean = rolled.map(cleanInsights);
    const same = rolled.every((r, i) => JSON.stringify(clean[i]) === JSON.stringify(r));
    const direct = texts.map(t => insightsOf(parseDetail(t)));
    const bad = [null, undefined, 5, 'x', [], {}, { v: 2 }, { v: 1 }, { v: 1, veh: 'x', kills: [], ev: [] }, { v: 1, veh: [['a', 'x', 1, 1]], kills: [], ev: [] },
      { v: 1, veh: [], kills: [], ev: [['a', 1, 1]] }, { v: 1, veh: new Array(500).fill(['a', 1, 1, 1]), kills: [], ev: [] }, { v: 1, veh: [[{}, 1, 1, 1]], kills: [], ev: [] },
      { v: 1, veh: [['a', NaN, 1, 1]], kills: [], ev: [] }, { v: 1, veh: [['a', Infinity, 1, 1]], kills: [], ev: [] }];
    return { same, equalsWorker: JSON.stringify(direct) === JSON.stringify(rolled), rejected: bad.map(cleanInsights).every(x => x === null), longName: cleanInsights({ v: 1, veh: [['x'.repeat(500), 1, 1, 1]], kills: [], ev: [] }).veh[0][0].length };
  }, many);
  t.check('a rollup computed in the worker equals one computed on the main thread', chk.equalsWorker);
  t.check('a well-formed rollup passes the validator unchanged', chk.same);
  t.check('malformed rollups (wrong types, NaN/Infinity, oversized lists, wrong version) are all rejected', chk.rejected);
  t.check('over-long names in a rollup are clipped, not trusted', chk.longName <= 120, String(chk.longName));
  await q.ctx.close();
};
