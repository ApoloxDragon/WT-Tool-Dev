/* ---------- Archive worker ---------- */
// Runs in a Web Worker so the heavy, repetitive work — compressing and decompressing stored matches and
// rolling their detail up for the Insights — happens off the main thread. The page stays responsive
// (typing, scrolling, tapping) instead of freezing while a few thousand matches are saved or read.
// The page talks to it through WtWorker in db.js, which falls back to doing the same work itself
// if workers are unavailable, fail to start or stall.
importScripts('util.js', 'detail-parser.js'); // LIMITS, capLines, parseDetail, insightsOf — none of them touch the page

const gzipText = async text => new Uint8Array(await new Response(new Response(text).body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
const gunzipBytes = async data => {
  if (typeof data === 'string') return data; // stored uncompressed (a browser without CompressionStream)
  const text = await new Response(new Response(data).body.pipeThrough(new DecompressionStream('gzip'))).text();
  if (text.length > LIMITS.MAX_BLOCK) throw new Error('stored match is larger than allowed');
  return text;
};

self.onmessage = async (e) => {
  const { id, op, items } = e.data;
  try {
    let out, transfer = [];
    if (op === 'pack') { out = await Promise.all(items.map(gzipText)); transfer = out.map(a => a.buffer); }
    else if (op === 'unpack') out = await Promise.all(items.map(async d => { try { return await gunzipBytes(d); } catch (err) { return null; } }));
    else if (op === 'insights') out = items.map(text => insightsOf(parseDetail(text)));
    else if (op === 'unpackInsights') out = await Promise.all(items.map(async d => { try { return insightsOf(parseDetail(await gunzipBytes(d))); } catch (err) { return null; } }));
    else throw new Error('unknown operation ' + op);
    self.postMessage({ id, ok: true, out }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
