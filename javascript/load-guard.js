/* ---------- Load guard ---------- */
// Tiny, and deliberately plain ES5 (no arrow functions, const, spread…) so that it still parses on a very
// old browser that cannot run the rest of the page. Loaded first in the <head>.
//
// What it does for people on slow connections or old devices:
//   * after a few seconds without the page being ready, a calm "still loading" note (gone once ready);
//   * if a file fails to arrive, or the page can't start (a browser too old, a script error), a visible
//     message with a Reload button, instead of a page that looks fine but does nothing.
// The app sets window.__wtReady (and fires "wt-ready") when its scripts have run.
(function () {
  var noteEl = null, noteIsError = false, slowTimer = null, failed = false;
  var SLOW_AFTER_MS = 3500;

  function ready() { return window.__wtReady === true; }

  function show(text, isError, withReload) {
    if (ready()) return;
    function put() {
      if (ready() && !isError) return;
      if (!document.body) return;
      if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
      noteEl = document.createElement('div');
      noteEl.className = 'load-note';
      noteEl.setAttribute('role', isError ? 'alert' : 'status');
      // inline fallback styling: this must be readable even if the stylesheet never arrived
      noteEl.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2000;padding:10px 14px;text-align:center;' +
        'font:13px/1.5 system-ui,Arial,sans-serif;background:var(--panel,#222);color:var(--text,#fff);border-top:2px solid ' +
        (isError ? 'var(--loss,#d16158)' : 'var(--accent,#4d9fe8)') + ';';
      noteEl.appendChild(document.createTextNode(text + ' '));
      if (withReload) {
        var b = document.createElement('button');
        b.type = 'button';
        b.appendChild(document.createTextNode('Reload'));
        b.style.cssText = 'font:inherit;padding:3px 12px;cursor:pointer;';
        b.addEventListener('click', function () { window.location.reload(); });
        noteEl.appendChild(b);
      }
      noteIsError = !!isError;
      document.body.appendChild(noteEl);
    }
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  }

  // The page became ready: the calm "still loading" note has done its job. An error note stays — e.g. the
  // page can be up and working while its stylesheet failed, and the person should still be told.
  function clear() {
    clearTimeout(slowTimer);
    if (noteEl && !noteIsError && noteEl.parentNode) { noteEl.parentNode.removeChild(noteEl); noteEl = null; }
  }

  function fail(text) {
    if (failed || ready()) return;
    failed = true;
    clearTimeout(slowTimer);
    show(text, true, true);
  }

  slowTimer = setTimeout(function () {
    if (!ready() && !failed) show('Still loading — this is taking a while on your connection. The page will work in a moment.', false, false);
  }, SLOW_AFTER_MS);

  document.addEventListener('wt-ready', clear);

  // A file (script or stylesheet) that fails to load fires "error" on its own element; capture it on the way down.
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t !== window && t.tagName && (t.tagName === 'SCRIPT' || (t.tagName === 'LINK' && /stylesheet/i.test(t.rel || '')))) {
      fail('Part of this page didn’t load — check your connection.');
    }
  }, true);

  // Once everything has been fetched and run, the page should be ready; if not, something stopped it from starting.
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!ready()) fail('This page couldn’t start — your browser may be too old, or a file failed to load.');
    }, 400);
  });
})();
