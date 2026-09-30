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
  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
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
  async function unpack(rec) {
    if (rec.enc === 'gzip') return gunzip(rec.data instanceof Uint8Array ? rec.data : new Uint8Array(rec.data));
    return rec.data;
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
  async function put(id, text) {
    if (!id || !text) return false;
    const db = await open();
    const rec = await pack(text);
    if (backend === 'idb') {
      const ok = await tx(db, 'readwrite', s => { s.put({ id, enc: rec.enc, data: rec.data, size: rec.size, saved: Date.now() }); return { result: true }; });
      return !!ok;
    }
    if (backend === 'ls') {
      try {
        const payload = rec.enc === 'gzip' ? 'g:' + bytesToB64(rec.data) : 'p:' + rec.data;
        localStorage.setItem(LS_PREFIX + id, payload);
        return true;
      } catch (e) { return false; } // quota exceeded
    }
    return false;
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

  // Every stored block as { id, text }. Used to rebuild the library.
  async function all() {
    const db = await open();
    const out = [];
    try {
      if (backend === 'idb') {
        const recs = (await tx(db, 'readonly', s => s.getAll())) || [];
        for (const rec of recs) out.push({ id: rec.id, text: await unpack(rec) });
      } else if (backend === 'ls') {
        for (const k of lsKeys()) {
          const text = await get(k.slice(LS_PREFIX.length));
          if (text !== null) out.push({ id: k.slice(LS_PREFIX.length), text });
        }
      }
    } catch (e) { /* return what we have */ }
    return out;
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
    put, get, ids, all, remove, clear, stats, requestPersistence,
    backendName: async () => { await open(); return backend; },
    codec: { canCompress, gzip, gunzip } // shared with raw export/import
  };
})();
