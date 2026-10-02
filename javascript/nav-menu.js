/* ---------- Phone menu ---------- */
// Below 680 px the top bar's controls fold behind a Menu button, with a "Jump to" list of the page's
// sections. The same elements are shown in a panel (not rebuilt); wide screens and no-JS are unchanged.
// Loaded after appearance-panel.js so the picker already holds the swatches and Customise.
const WtMenu = (() => {
  const narrow = matchMedia('(max-width: 680px)');
  const JUMPS = {
    basic: [['Paste logs', '#input'], ['Battle-type rules', '.rules-toggle'], ['Overall', '#overallStats'], ['Battle types', '#splitTable'],
      ['Goal calculator', '#goalCalcSection'], ['Research targets', '#targetTable'], ['Per-match detail', '#matchTable']],
    advanced: [['Library', '#librarySection'], ['Match detail', '#detailSection'], ['Insights', '#insightsSection'], ['Storage', '#storageSection']]
  };
  let bar, picker, btn, jump, list;
  const isOpen = () => bar.classList.contains('menu-open');
  const set = open => {
    if (!bar) return;
    if (open) fill();
    bar.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open);
  };
  // Rebuilt on every open, so it only offers sections that are on screen right now.
  function fill() {
    const seen = new Set();
    list.textContent = '';
    (JUMPS[document.body.dataset.page] || []).forEach(([label, sel]) => {
      const el = document.querySelector(sel), sec = el && (el.closest('.section') || el);
      if (!el || !el.getClientRects().length || seen.has(sec)) return;
      seen.add(sec);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu-jump-link'; b.textContent = label;
      b.onclick = () => { set(false); sec.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
      list.append(b);
    });
    jump.hidden = !seen.size;
  }

  bar = document.querySelector('.topbar'); picker = document.getElementById('themePicker');
  if (bar && picker) {
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'menu-btn'; btn.id = 'menuBtn';
    btn.innerHTML = '<span aria-hidden="true">☰</span> Menu';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'themePicker');
    btn.onclick = () => set(!isOpen());
    bar.insertBefore(btn, picker);
    jump = document.createElement('nav');
    jump.className = 'menu-jump'; jump.hidden = true; jump.setAttribute('aria-label', 'Jump to a section');
    jump.innerHTML = '<div class="menu-jump-title">Jump to</div><div class="menu-jump-list"></div>';
    list = jump.lastChild;
    const view = picker.querySelector('.view-link');
    picker.insertBefore(jump, view ? view.nextSibling : picker.firstChild);
    bar.classList.add('has-menu');
    // Close on Escape (focus back on the button), on a tap outside, after Tutorial / Customise, and on a wide screen.
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !document.getElementById('tutCard')) { set(false); btn.focus(); } });
    document.addEventListener('click', e => { if (isOpen() && !bar.contains(e.target) && !e.target.closest('.tut-card, .tut-backdrop, .tut-spot')) set(false); });
    picker.addEventListener('click', e => { if (e.target.closest('#tutorialBtn, #colourBtn')) setTimeout(() => document.getElementById('tutCard') || set(false), 0); });
    narrow.addEventListener('change', () => narrow.matches || set(false));
  }

  return {
    // For the tutorial: open the menu for a step that points at something inside it, close it otherwise.
    sync(selector) { if (!bar || !narrow.matches) return; const el = selector && document.querySelector(selector); set(!!el && picker.contains(el)); },
    close: () => set(false)
  };
})();
