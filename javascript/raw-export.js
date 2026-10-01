/* ---------- Raw export / import ---------- */
// Raw export = the original match text blocks, nothing derived. Re-importing it
// rebuilds every summary and per-event detail from scratch, so an old export
// keeps getting richer as the parser improves.
//
// File formats accepted on import:
//   .json      { format: 'wt-raw-export', version, matches: [{ id, raw }] }
//   .json.gz   the same, gzip-compressed (much smaller)
//   .txt       plain pasted match logs
// Depends on: WtDB (db.js), parseLog/summaryOf (parser.js), LIMITS/WtLimitError/fmtMB (util.js).

const RAW_EXPORT_FORMAT = 'wt-raw-export';
const RAW_EXPORT_VERSION = 1;

// Filename-safe local-time stamp (no ":" or "/", which are invalid in
// Windows filenames) so repeated exports don't overwrite each other.
function localTimestampForFilename(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Analyze archives its matches in the background. Exports wait for those writes,
// so a backup is never missing the matches that were analysed a moment ago.
let pendingArchiveWrites = Promise.resolve();
function trackArchiveWrite(promise) {
  pendingArchiveWrites = pendingArchiveWrites.then(() => promise).catch(() => {});
  return promise;
}

// ids: optional array of session IDs to export; default is the whole archive.
async function buildRawExport(ids) {
  await pendingArchiveWrites;
  const wanted = ids ? new Set(ids) : null;
  const blocks = (await WtDB.all()).filter(b => !wanted || wanted.has(b.id));
  blocks.sort((a, b) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : 1));
  return {
    format: RAW_EXPORT_FORMAT,
    version: RAW_EXPORT_VERSION,
    exported: new Date().toISOString(),
    count: blocks.length,
    matches: blocks.map(b => ({ id: b.id, raw: b.text }))
  };
}

// Returns the number of matches exported (0 = nothing to export, nothing downloaded).
async function downloadRawExport({ gzip = true, ids } = {}) {
  const data = await buildRawExport(ids);
  if (data.count === 0) return 0;
  const json = JSON.stringify(data);
  const stamp = localTimestampForFilename(new Date());
  if (gzip && WtDB.codec.canCompress) {
    const bytes = await WtDB.codec.gzip(json);
    downloadBlob(new Blob([bytes], { type: 'application/gzip' }), `wt-raw-export-${stamp}.json.gz`);
  } else {
    downloadBlob(new Blob([json], { type: 'application/json' }), `wt-raw-export-${stamp}.json`);
  }
  if (!ids) saveState('lastRawExport', { at: Date.now(), count: data.count });
  return data.count;
}

// Reads a file chosen by the user. Resolves to an array of raw block strings, or
// null if the file isn't a raw export / plain log (so callers can try other formats).
async function readRawFile(file) {
  if (file.size > LIMITS.MAX_IMPORT_FILE) {
    throw new WtLimitError(`That file is ${fmtMB(file.size)} — too large to import (limit ${fmtMB(LIMITS.MAX_IMPORT_FILE)}).`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {           // gzip magic bytes
    if (!WtDB.codec.canCompress) throw new Error('This browser cannot read .gz files.');
    text = await WtDB.codec.gunzip(buf, LIMITS.MAX_UNPACKED); // throws WtLimitError past the cap
  } else {
    text = new TextDecoder().decode(buf);
  }

  let blocks = null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && !Array.isArray(parsed) && parsed.format === RAW_EXPORT_FORMAT && Array.isArray(parsed.matches)) {
      blocks = parsed.matches.slice(0, LIMITS.MAX_IMPORT_MATCHES).map(m => m && m.raw).filter(r => typeof r === 'string' && r.length <= LIMITS.MAX_BLOCK);
    } else {
      return null; // some other JSON (e.g. the minimal export) — not ours
    }
  } catch (err) {
    blocks = [text];  // not JSON: treat as pasted logs
  }

  // Self-validating: every block is re-parsed, and only what parseLog recognises
  // as real matches (with a Session ID) is kept. The id in the file is ignored.
  const out = [];
  blocks.forEach(b => parseLog(b).forEach(m => { if (m.raw && !m.sessionId.startsWith('noid-')) out.push(m); }));
  return out.length ? out : null;
}

// Saves parsed matches (with .raw) into the archive in one batched write.
// Resolves to { added, skipped, failed }.
async function archiveParsedMatches(matches) {
  const have = new Set(await WtDB.ids());
  const fresh = [];
  let skipped = 0;
  for (const m of matches) {
    if (have.has(m.sessionId)) { skipped++; continue; }
    have.add(m.sessionId);
    fresh.push({ id: m.sessionId, text: m.raw, sum: summaryOf(m) });
  }
  const added = await WtDB.putMany(fresh);
  return { added, skipped, failed: fresh.length - added };
}
