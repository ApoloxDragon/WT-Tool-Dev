/* ---------- Offline support: registering the service worker ---------- */
// Installs /sw.js (see tools/sw.template.js) so return visits are instant and the app works offline, and offers
// "New version ready — Reload" when an update is waiting. Everything here is optional: if service workers are
// unavailable or blocked, nothing changes — the page just loads from the network as before.
//
// On localhost / 127.0.0.1 it stays OFF by default, so that while you are editing the code a cached copy can never
// hide your changes (and any worker left over from earlier is removed). To try it locally:
//   localStorage.setItem('wtSessionReadout.enableServiceWorkerLocally', 'true')   // then reload
(function () {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let enabledLocally = false;
  try { enabledLocally = localStorage.getItem('wtSessionReadout.enableServiceWorkerLocally') === 'true'; } catch (e) { /* storage blocked */ }

  if (local && !enabledLocally) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    return;
  }

  const hadController = !!navigator.serviceWorker.controller; // true when an older version is running this page

  function offerUpdate(waiting) {
    if (document.querySelector('.update-note')) return;
    const note = document.createElement('div');
    note.className = 'update-note';
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2000;padding:10px 14px;text-align:center;font:13px/1.5 system-ui,Arial,sans-serif;' +
      'background:var(--panel,#222);color:var(--text,#fff);border-top:2px solid var(--accent,#4d9fe8);';
    note.append('A new version is ready. ');
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:inherit;padding:3px 12px;margin-left:6px;cursor:pointer;'; b.addEventListener('click', fn); return b; };
    note.append(mk('Reload', () => waiting.postMessage('skipWaiting')), mk('Later', () => note.remove()));
    document.body.appendChild(note);
  }

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    if (reg.waiting && hadController) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); });
    });
    reg.update().catch(() => {}); // look for a newer version now, in the background
  }).catch(() => { /* blocked or unsupported: carry on without it */ });

  // The new version took over (after the person pressed Reload): load the page again, once, to run it.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; // the very first install also fires this; no reload needed then
    reloading = true;
    location.reload();
  });
})();
