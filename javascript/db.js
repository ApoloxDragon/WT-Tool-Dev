/* ---------- Raw match archive (IndexedDB, gzip-compressed) ---------- */
// The archive holds the ORIGINAL text block of every match, keyed by Session ID.
// Everything else (summary, per-event detail) is derived from it, so it is the
// one thing worth keeping. Raw blocks gzip roughly 8x, which keeps thousands of
// matches well inside browser quotas.
//
// Backends, in order of preference:
//   1. IndexedDB  (large quota)
//   2. localStorage (~5 MB, compressed text only) if IndexedDB is unavailable
// Every method returns a Promise and never rejects: a failure resolves to a
// falsy/empty value so the rest of the app keeps working without persistence.
//
// NOTE: the Dev build uses its own database name so unstable builds can never
// touch the stable site's data (both live on the same github.io origin).

// Client for archive-worker.js. Every call that uses it has a main-thread fallback, so a worker that is
// unsupported, blocked, slow to arrive or crashed never breaks saving or reading — it just costs smoothness.
const WtWorker = (() => {
  let worker = null, broken = false, seq = 0;
  const pending = new Map();
  const api = { timeoutMs: 30000 }; // per call; exposed so tests can shorten it
  function giveUp() {
    broken = true;
    if (worker) { try { worker.terminate(); } catch (e) { /* already gone */ } worker = null; }
    pending.forEach(p => { clearTimeout(p.timer); p.reject(new Error('worker unavailable')); });
    pending.clear();
  }
  function start() {
    if (worker || broken) return worker;
    if (typeof Worker !== 'function') { broken = true; return null; }
    try {
      worker = new Worker('javascript/archive-worker.js');
      worker.onmessage = e => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id); clearTimeout(p.timer);
        if (e.data.ok) p.resolve(e.data.out); else p.reject(new Error(e.data.error));
      };
      worker.onerror = giveUp; // the script failed to load or crashed
    } catch (err) { broken = true; worker = null; }
    return worker;
  }
  api.available = () => !!start();
  api.call = (op, items) => new Promise((resolve, reject) => {
    const w = start();
    if (!w) { reject(new Error('no worker')); return; }
    const id = ++seq;
    const timer = setTimeout(() => { if (pending.has(id)) giveUp(); }, api.timeoutMs); // a stalled worker is abandoned, and so are its calls
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, op, items });
  });
  return api;
})();

const WtDB = (() => {
  const DB_NAME = 'wtSessionReadout-dev';
  const STORE = 'raw';
  const LS_PREFIX = 'wtSessionReadout.raw.';
  let dbPromise = null;
  let backend = null; // 'idb' | 'ls' | 'none', decided on first open

  /* ----- compression (native CompressionStream; plain text if unsupported) ----- */
  const canCompress = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  async function gzip(text) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // Streams the output and stops as soon as it would exceed `maxBytes`, so a tiny
  // "bomb" file can never be expanded into memory.
  async function gunzip(bytes, maxBytes) {
    const limit = maxBytes || LIMITS.MAX_UNPACKED;
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new WtLimitError(`That file is too large once unpacked (limit ${fmtMB(limit)}) — it was not opened.`);
      }
      chunks.push(value);
    }
    return await new Blob(chunks).text();
  }
  function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function pack(text) {
    const size = text.length;
    if (canCompress) {
      try { return { enc: 'gzip', data: await gzip(text), size }; } catch (e) { /* fall through */ }
    }
    return { enc: 'none', data: text, size };
  }
  // Stored records take the fast path (no size limit while unpacking): putMany() refuses
  // any text over MAX_BLOCK before it is compressed, so what is stored cannot expand
  // beyond that. Files chosen by the user are different — they use the bounded gunzip().
  async function unpack(rec) {
    if (rec.enc !== 'gzip') return rec.data;
    const bytes = rec.data instanceof Uint8Array ? rec.data : new Uint8Array(rec.data);
    const text = await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).text();
    if (text.length > LIMITS.MAX_BLOCK) throw new Error('stored match is larger than allowed');
    return text;
  }

  // Batches go to the worker (off the main thread); anything it can't do falls back to doing it here.
  async function packMany(texts) {
    if (canCompress && WtWorker.available()) {
      try {
        const bytes = await WtWorker.call('pack', texts);
        return bytes.map((b, i) => ({ enc: 'gzip', data: b, size: texts[i].length }));
      } catch (e) { /* fall back to the main thread */ }
    }
    return Promise.all(texts.map(pack));
  }
  async function unpackMany(recs) {
    if (recs.every(r => r.enc === 'gzip') && WtWorker.available()) {
      try {
        const texts = await WtWorker.call('unpack', recs.map(r => r.data));
        return texts.map(t => (typeof t === 'string' ? t : null));
      } catch (e) { /* fall back to the main thread */ }
    }
    return Promise.all(recs.map(async rec => { try { return await unpack(rec); } catch (e) { return null; } }));
  }
  const storedBytes = rec => (rec.enc === 'gzip' ? rec.data.length : rec.data.length * 2);

  /* ----- backend selection ----- */
  function openIDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function open() {
    if (!dbPromise) {
      dbPromise = openIDB().then(db => {
        if (db) { backend = 'idb'; return db; }
        try { localStorage.setItem(LS_PREFIX + '_probe', '1'); localStorage.removeItem(LS_PREFIX + '_probe'); backend = 'ls'; }
        catch (e) { backend = 'none'; }
        return null;
      });
    }
    return dbPromise;
  }

  function tx(db, mode, fn) {
    return new Promise((resolve) => {
      let result;
      try {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        result = fn(store);
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        t.onerror = t.onabort = () => resolve(undefined);
      } catch (e) { resolve(undefined); }
    });
  }

  function lsKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX) && k !== LS_PREFIX + '_probe') keys.push(k);
      }
    } catch (e) { /* ignore */ }
    return keys;
  }

  /* ----- public API ----- */
  // Stores many matches in ONE transaction (one round trip instead of one per match).
  // entries: [{ id, text, sum }] — `sum` is an optional small summary kept beside the
  // compressed text so lists can be shown without decompressing anything.
  // Resolves to how many were stored. Over-long or empty entries are skipped.
  async function putMany(entries) {
    const good = entries.filter(e => e && e.id && e.text && e.text.length <= LIMITS.MAX_BLOCK); // a real match is a few KB
    if (!good.length) return 0;
    const db = await open();
    const packed = [];
    for (let i = 0; i < good.length; i += 200) {    // 200 at a time, compressed in the worker
      const chunk = good.slice(i, i + 200);
      const recs = await packMany(chunk.map(e => e.text));
      chunk.forEach((e, k) => packed.push({ e, rec: recs[k] }));
    }
    if (backend === 'idb') {
      const stored = await tx(db, 'readwrite', s => {
        const now = Date.now();
        packed.forEach(({ e, rec }) => s.put({ id: e.id, enc: rec.enc, data: rec.data, size: rec.size, saved: now, sum: e.sum }));
        return { result: packed.length };
      });
      return stored || 0; // undefined = the transaction failed or aborted (e.g. quota)
    }
    if (backend === 'ls') {
      let n = 0;
      for (const { e, rec } of packed) {
        try { localStorage.setItem(LS_PREFIX + e.id, rec.enc === 'gzip' ? 'g:' + bytesToB64(rec.data) : 'p:' + rec.data); n++; }
        catch (err) { break; } // quota exceeded
      }
      return n;
    }
    return 0;
  }

  async function put(id, text) {
    return (await putMany([{ id, text }])) === 1;
  }

  async function get(id) {
    const db = await open();
    try {
      if (backend === 'idb') {
        const rec = await tx(db, 'readonly', s => s.get(id));
        return rec ? await unpack(rec) : null;
      }
      if (backend === 'ls') {
        const v = localStorage.getItem(LS_PREFIX + id);
        if (v === null) return null;
        return v.startsWith('g:') ? await gunzip(b64ToBytes(v.slice(2))) : v.slice(2);
      }
    } catch (e) { /* corrupt entry */ }
    return null;
  }

  // Every stored session ID (cheap: reads keys only).
  async function ids() {
    const db = await open();
    if (backend === 'idb') return (await tx(db, 'readonly', s => s.getAllKeys())) || [];
    if (backend === 'ls') return lsKeys().map(k => k.slice(LS_PREFIX.length));
    return [];
  }

  // Decompresses records in parallel batches. A damaged record is skipped, not fatal.
  async function unpackAll(recs) {
    const out = [];
    for (let i = 0; i < recs.length; i += 100) {
      const chunk = recs.slice(i, i + 100);
      const texts = await unpackMany(chunk);
      chunk.forEach((rec, k) => { if (typeof texts[k] === 'string') out.push({ id: rec.id, text: texts[k] }); });
    }
    return out;
  }

  // Every stored block as { id, text }.
  async function all() {
    const db = await open();
    try {
      if (backend === 'idb') return await unpackAll((await tx(db, 'readonly', s => s.getAll())) || []);
      if (backend === 'ls') {
        const out = [];
        for (const k of lsKeys()) {
          const text = await get(k.slice(LS_PREFIX.length));
          if (text !== null) out.push({ id: k.slice(LS_PREFIX.length), text });
        }
        return out;
      }
    } catch (e) { /* fall through */ }
    return [];
  }

  // The stored records for these ids (missing ones left out), without unpacking anything.
  async function fetchRecords(ids) {
    const db = await open();
    if (backend !== 'idb') return [];
    const reqs = await tx(db, 'readonly', s => ids.map(id => s.get(id)));
    return (reqs || []).map(r => r.result).filter(Boolean);
  }

  // The blocks for just these ids, as { id, text } (missing or damaged ones left out).
  async function getMany(ids) {
    try {
      await open();
      if (backend === 'ls') {
        const out = [];
        for (const id of ids) { const text = await get(id); if (text !== null) out.push({ id, text }); }
        return out;
      }
      return await unpackAll(await fetchRecords(ids));
    } catch (e) { return []; }
  }

  // Insight rollups (see insightsOf) for these texts / these stored ids. The work happens in the worker;
  // without one, it is done here in small slices with a breath between them so the page stays responsive.
  async function insightsFromTexts(texts) {
    const out = [];
    for (let i = 0; i < texts.length; i += 100) {
      const chunk = texts.slice(i, i + 100);
      let part = null;
      if (WtWorker.available()) { try { part = await WtWorker.call('insights', chunk); } catch (e) { part = null; } }
      if (!part) {
        part = [];
        for (let k = 0; k < chunk.length; k++) {
          part.push(insightsOf(parseDetail(chunk[k])));
          if (k % 20 === 19) await new Promise(r => setTimeout(r, 0));
        }
      }
      out.push(...part);
    }
    return out;
  }
  // Resolves to an array aligned with `ids`: a rollup, or null where the record is missing or unreadable.
  async function insightsForIds(ids) {
    const recs = await fetchRecords(ids);
    const byId = new Map(recs.map(r => [r.id, r]));
    const out = new Array(ids.length).fill(null);
    for (let i = 0; i < ids.length; i += 100) {
      const idx = [], items = [];
      for (let k = i; k < Math.min(i + 100, ids.length); k++) { const r = byId.get(ids[k]); if (r) { idx.push(k); items.push(r); } }
      if (!items.length) continue;
      let part = null;
      if (items.every(r => r.enc === 'gzip') && WtWorker.available()) {
        try { part = await WtWorker.call('unpackInsights', items.map(r => r.data)); } catch (e) { part = null; }
      }
      if (!part) {
        const texts = await unpackMany(items);
        part = texts.map(t => (typeof t === 'string' ? insightsOf(parseDetail(t)) : null));
      }
      idx.forEach((k, j) => { out[k] = part[j]; });
    }
    return out;
  }

  // { id, size, sum } for every record WITHOUT decompressing anything. `sum` is null for
  // records stored without a summary (older builds, or the localStorage fallback).
  async function meta() {
    const db = await open();
    if (backend === 'idb') {
      const recs = (await tx(db, 'readonly', s => s.getAll())) || [];
      return recs.map(r => ({ id: r.id, size: r.size || 0, sum: r.sum || null }));
    }
    if (backend === 'ls') return lsKeys().map(k => ({ id: k.slice(LS_PREFIX.length), size: 0, sum: null }));
    return [];
  }

  // pairs: [[id, sum], …] — attaches a summary to records that already exist.
  async function setSummaries(pairs) {
    const db = await open();
    if (backend !== 'idb' || !pairs.length) return 0;
    return (await tx(db, 'readwrite', s => {
      pairs.forEach(([id, sum]) => {
        const g = s.get(id);
        g.onsuccess = () => { if (g.result) { g.result.sum = sum; s.put(g.result); } };
      });
      return { result: pairs.length };
    })) || 0;
  }

  async function remove(id) {
    const db = await open();
    if (backend === 'idb') { await tx(db, 'readwrite', s => { s.delete(id); return { result: true }; }); return true; }
    if (backend === 'ls') { try { localStorage.removeItem(LS_PREFIX + id); } catch (e) {} return true; }
    return false;
  }

  async function clear() {
    const db = await open();
    if (backend === 'idb') { await tx(db, 'readwrite', s => { s.clear(); return { result: true }; }); return true; }
    if (backend === 'ls') { lsKeys().forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); return true; }
    return false;
  }

  // { count, rawBytes, storedBytes, backend, quota, usage }
  async function stats() {
    const db = await open();
    const out = { count: 0, rawBytes: 0, storedBytes: 0, backend, quota: null, usage: null };
    try {
      if (backend === 'idb') {
        const recs = (await tx(db, 'readonly', s => s.getAll())) || [];
        recs.forEach(r => { out.count++; out.rawBytes += r.size || 0; out.storedBytes += storedBytes(r); });
      } else if (backend === 'ls') {
        lsKeys().forEach(k => { out.count++; out.storedBytes += localStorage.getItem(k).length; });
        out.rawBytes = out.storedBytes; // not tracked in this backend
      }
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        out.quota = est.quota || null; out.usage = est.usage || null;
      }
    } catch (e) { /* partial stats are fine */ }
    return out;
  }

  // Ask the browser not to evict the archive under storage pressure.
  async function requestPersistence() {
    try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); }
    catch (e) { return false; }
  }

  return {
    put, putMany, get, getMany, ids, all, meta, setSummaries, remove, clear, stats, requestPersistence, insightsFromTexts, insightsForIds,
    backendName: async () => { await open(); return backend; },
    codec: { canCompress, gzip, gunzip } // shared with raw export/import
  };
})();
