/* ---------- Phone menu ---------- */
// On narrow screens the top bar's controls (view switch, tutorial, GitHub link, colours) don't fit in a
// row, so they fold behind a Menu button that also lists the page's sections to jump to. Nothing is moved
// or rebuilt: the same elements are simply shown in a panel, so every other script keeps working. On wide
// screens, and without JavaScript, the top bar is unchanged (the CSS only applies under .has-menu).
// Depends on the markup of both views (.topbar, #themePicker); loaded after appearance-panel.js so the
// picker already holds the swatches and the Customise button.

const WtMenu = (() => {
  const narrow = window.matchMedia('(max-width: 680px)');
  // Sections to jump to, by page. A section is listed only while it is on screen (e.g. Results after Analyze).
  const JUMPS = {
    basic: [
      ['Paste logs', '#input'],
      ['Battle-type rules', '.rules-toggle'],
      ['Overall', '#overallStats'],
      ['Battle types', '#splitTable'],
      ['Goal calculator', '#goalCalcSection'],
      ['Research targets', '#targetTable'],
      ['Per-match detail', '#matchTable']
    ],
    advanced: [
      ['Library', '#librarySection'],
      ['Match detail', '#detailSection'],
      ['Insights', '#insightsSection'],
      ['Storage', '#storageSection']
    ]
  };
  const shown = el => !!el && el.getClientRects().length > 0;
  const sectionOf = el => el.closest('.section') || el;

  let topbar, picker, button, jump;

  function isOpen() { return !!topbar && topbar.classList.contains('menu-open'); }

  function set(open) {
    if (!topbar) return;
    if (open) buildJumps();
    topbar.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  // Rebuilt every time the menu opens, so it only offers sections that exist right now.
  function buildJumps() {
    const links = (JUMPS[document.body.dataset.page] || []).map(([label, sel]) => [label, sectionOf(document.querySelector(sel) || document.body), document.querySelector(sel)])
      .filter(([, , el]) => shown(el));
    const seen = new Set();
    jump.querySelector('.menu-jump-list').replaceChildren(...links.filter(([, sec]) => !seen.has(sec) && seen.add(sec)).map(([label, sec]) => {
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'menu-jump-link';
      a.textContent = label;
      a.addEventListener('click', () => {
        set(false);
        sec.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      return a;
    }));
    jump.hidden = !links.length;
  }

  // Used by the tutorial: open the menu for a step that points at something inside it, close it otherwise.
  function sync(selector) {
    if (!topbar || !narrow.matches) return;
    const el = selector ? document.querySelector(selector) : null;
    set(!!el && picker.contains(el));
  }

  function init() {
    topbar = document.querySelector('.topbar');
    picker = document.getElementById('themePicker');
    if (!topbar || !picker) return;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-btn';
    button.id = 'menuBtn';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'themePicker');
    button.innerHTML = '<span class="menu-btn-icon" aria-hidden="true">☰</span> Menu';
    button.addEventListener('click', () => set(!isOpen()));
    topbar.insertBefore(button, picker);

    jump = document.createElement('nav');
    jump.className = 'menu-jump';
    jump.setAttribute('aria-label', 'Jump to a section');
    jump.hidden = true;
    jump.innerHTML = '<div class="menu-jump-title">Jump to</div><div class="menu-jump-list"></div>';
    const viewLink = picker.querySelector('.view-link');
    picker.insertBefore(jump, viewLink ? viewLink.nextSibling : picker.firstChild);

    topbar.classList.add('has-menu');

    // Close on Escape (focus goes back to the button), on a tap outside, after using Tutorial or Customise,
    // and whenever the screen becomes wide enough for the normal top bar.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen() && !document.getElementById('tutCard')) { set(false); button.focus(); }
    });
    document.addEventListener('click', e => { if (isOpen() && !topbar.contains(e.target) && !e.target.closest('.tut-card, .tut-backdrop, .tut-spot')) set(false); });
    picker.addEventListener('click', e => {
      if (e.target.closest('#tutorialBtn, #colourBtn')) setTimeout(() => { if (!document.getElementById('tutCard')) set(false); }, 0);
    });
    narrow.addEventListener('change', () => { if (!narrow.matches) set(false); });
  }

  init();
  return { sync, close: () => set(false), isOpen };
})();
