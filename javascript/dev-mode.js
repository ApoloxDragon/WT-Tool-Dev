/* ---------- Dev site marker ---------- */
// Loaded only on the dev site (appearance-core.js decides that from the URL, see WT_DEV), so the stable site never
// downloads or runs it. The page announces itself: a banner, "[DEV]" in the tab title, the dev icon (red corner) and a
// GitHub link to the dev repo. Because it is decided at runtime, merging Dev into main can't turn stable into the dev
// site, or the reverse.
(function () {
  function mark() {
    const style = document.createElement('style');
    style.textContent = '.dev-banner{background:var(--loss);color:var(--on-loss,#fff);text-align:center;font-size:.78125rem;font-weight:700;letter-spacing:.02em;padding:8px 12px}.dev-banner a{color:inherit}';
    document.head.append(style);
    const banner = document.createElement('div');
    banner.className = 'dev-banner';
    banner.innerHTML = '⚠ Development build — testing in progress, not guaranteed stable. <a href="https://apoloxdragon.github.io/WarThunder-Tool/">Use the stable version</a> for reliable results.';
    document.body.prepend(banner);
    document.title = '[DEV] ' + document.title;
    const gh = document.querySelector('.github-link');
    if (gh) gh.href = 'https://github.com/ApoloxDragon/WT-Tool-Dev';
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => { l.href = l.getAttribute('href').replace('assets/icon', 'assets/icon-dev'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
})();