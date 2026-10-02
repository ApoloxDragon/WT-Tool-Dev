/* Service worker — GENERATED into /sw.js by tools/build.js from this template. Edit THIS file, then run the build.
 *
 * What it does: after the first visit the whole app (pages, styles, scripts, the worker) is served from a local
 * cache, so return visits are instant on any connection and the app works with no connection at all.
 *
 * How it stays safe:
 *   - Everything is cached under ONE name that contains a hash of all the files (VERSION). The HTML and the
 *     bundles it points to therefore always come from the same version — never a new page with old scripts.
 *   - An update installs quietly in the background and WAITS; the page offers "New version ready — Reload".
 *     Nothing changes underneath someone who is mid-session.
 *   - It only deletes caches that carry its own prefix, so it can't touch anything else on this origin (the
 *     stable site lives on the same origin).
 *   - It only handles same-origin GET requests inside its own folder. Everything else is left alone.
 *   - If caching the app fails for any reason, installation fails and the site simply keeps working from the network. */
const VERSION = 'dccd561560';
const PRECACHE = [
  "index.html",
  "wt-log-analyzer.html",
  "advanced.html",
  "css/styles.css",
  "assets/github-logo.png",
  "javascript/load-guard.js",
  "javascript/appearance-core.js",
  "javascript/archive-worker.js",
  "javascript/util.js",
  "javascript/detail-parser.js",
  "dist/app-basic.js?v=4a8de076",
  "dist/extras.js?v=22db7a78",
  "dist/app-advanced.js?v=07d1cfa7"
];

const PREFIX = 'wt-tool-dev-';
const SHELL = PREFIX + 'shell-' + VERSION;   // the app, one immutable set per version
const EXAMPLES = PREFIX + 'examples';        // the sample logs, kept after the first time they are fetched
const SCOPE_PATH = new URL('./', self.location.href).pathname;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      // cache: 'reload' = ask the network, not the browser's HTTP cache, so a stale copy can't be frozen into this version
      await Promise.all(PRECACHE.map(async url => {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error('could not cache ' + url + ' (' + res.status + ')');
        await cache.put(url, res);
      }));
    } catch (err) {
      await caches.delete(SHELL); // never leave a half-filled version behind
      throw err;                  // …and fail the installation, so this worker never takes over
    }
    // deliberately no skipWaiting(): a new version waits until the page asks for it (message below) or all tabs are closed
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(PREFIX + 'shell-') && n !== SHELL).map(n => caches.delete(n))); // only OUR old versions
    await self.clients.claim(); // let the very first visit be controlled straight away (works offline without a reload)
  })());
});

self.addEventListener('message', event => { if (event.data === 'skipWaiting') self.skipWaiting(); }); // the page's "Reload" button

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  event.respondWith(respond(req, url));
});

async function respond(req, url) {
  const shell = await caches.open(SHELL);
  let key = req, ignoreSearch = false;
  if (req.mode === 'navigate') {              // a folder URL means its index.html; a query string doesn't change the page
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    key = new Request(url.origin + path); ignoreSearch = true;
  }
  const hit = await shell.match(key, { ignoreSearch });
  if (hit) return hit;
  if (url.pathname.includes('/example%20data/')) return examples(req);
  try { return await fetch(req); } catch (err) { return Response.error(); } // not part of the app and offline
}

// Sample logs: network first (so they stay current), the last copy when offline.
async function examples(req) {
  const cache = await caches.open(EXAMPLES);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || Response.error();
  }
}
