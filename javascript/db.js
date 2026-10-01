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
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    if (text.length > LIMITS.MAX_BLOCK) throw new Error('stored match is larger than allowed');
    return text;
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
    for (let i = 0; i < good.length; i += 32) {     // compress 32 at a time, in parallel
      packed.push(...await Promise.all(good.slice(i, i + 32).map(async e => ({ e, rec: await pack(e.text) }))));
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
    for (let i = 0; i < recs.length; i += 32) { // 16-64 at once measured fastest
      const batch = await Promise.all(recs.slice(i, i + 32).map(async rec => {
        try { return { id: rec.id, text: await unpack(rec) }; } catch (e) { return null; }
      }));
      batch.forEach(b => { if (b) out.push(b); });
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

  // The blocks for just these ids, as { id, text } (missing or damaged ones left out).
  async function getMany(ids) {
    const db = await open();
    try {
      if (backend === 'idb') {
        const reqs = await tx(db, 'readonly', s => ids.map(id => s.get(id)));
        return await unpackAll((reqs || []).map(r => r.result).filter(Boolean));
      }
      if (backend === 'ls') {
        const out = [];
        for (const id of ids) { const text = await get(id); if (text !== null) out.push({ id, text }); }
        return out;
      }
    } catch (e) { /* fall through */ }
    return [];
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
    put, putMany, get, getMany, ids, all, meta, setSummaries, remove, clear, stats, requestPersistence,
    backendName: async () => { await open(); return backend; },
    codec: { canCompress, gzip, gunzip } // shared with raw export/import
  };
})();
