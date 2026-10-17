/* ---------- Phone menu ---------- */
// Below 680 px the top bar's controls fold behind a Menu button (plus a "Jump to" list). The same elements are shown in a panel; wide screens and no-JS are unchanged. Loaded after appearance-panel.js.
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
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !document.getElementById('tutCard')) { set(false); btn.focus(); } });
    document.addEventListener('click', e => { if (isOpen() && !bar.contains(e.target) && !e.target.closest('.tut-card, .tut-backdrop, .tut-spot')) set(false); });
    picker.addEventListener('click', e => { if (e.target.closest('#tutorialBtn, #colourBtn')) setTimeout(() => document.getElementById('tutCard') || set(false), 0); });
    narrow.addEventListener('change', () => narrow.matches || set(false));
  }

  return {
    // for the tutorial: open for a step that points inside the menu, close otherwise
    sync(selector) { if (!bar || !narrow.matches) return; const el = selector && document.querySelector(selector); set(!!el && picker.contains(el)); },
    close: () => set(false)
  };
})();

/* ---------- Phone tables as cards ---------- */
// Below 680 px tables with 4+ columns are drawn one card per row (CSS: table.stack). Each cell needs its column name as a label, copied here from the header row.
const WtStackTables = (() => {
  const narrow = matchMedia('(max-width: 680px)');
  let queued = false;
  function label(table) {
    const head = table.querySelector('tr');
    const names = head && head.querySelectorAll('th').length >= 4 ? [...head.children].map(c => c.textContent.trim()) : null;
    if (!names) { table.classList.remove('stack'); return; }
    table.classList.add('stack'); head.classList.add('stack-head');
    for (const tr of table.querySelectorAll('tr')) {
      if (tr === head || tr.dataset.stacked) continue;
      tr.dataset.stacked = '1';
      [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && names[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', names[i]); });
    }
  }
  const run = () => { queued = false; if (narrow.matches) document.querySelectorAll('table').forEach(label); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  narrow.addEventListener('change', queue);
  queue();
})();
