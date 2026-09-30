/* ---------- Guided tutorial ---------- */
// A spotlight tour: dims the page, outlines one control at a time and shows a
// card explaining it. Steps are plain data below — to document a new feature,
// add a step. Auto-opens once per page (remembered in localStorage) and can be
// reopened from the "? Tutorial" button.
// Depends on: storage.js (loadState/saveState). Page is chosen via <body data-page>.

const TUTORIAL_STEPS = {
  basic: [
    { title: 'Welcome to Session Readout',
      text: 'Paste War Thunder match logs and get win rates, SL/RP totals, research progress and a goal estimate. Everything runs in your browser — nothing is uploaded. This short tour covers each part. Use the buttons or the ← → keys; Esc closes it. You can reopen it any time from “? Tutorial”.' },
    { target: '#input', title: '1 · Paste your logs',
      text: 'Paste one or more match reports here — from the “Victory/Defeat in the [Mode] … mission!” line down through the “Total:” line. Overlapping pastes are fine: matches are deduped by Session ID, so nothing is counted twice.' },
    { target: '#analyzeBtn', title: '2 · Analyze',
      text: 'Click Analyze to process the text. No logs handy? “Load Example Data” fills in a sample (this only works on the hosted page, not a file opened from disk). “Clear” resets the current session but keeps your saved archive.' },
    { target: 'details.rules-toggle', title: '3 · Battle-type categories',
      text: 'Matches are split by battle type. Tank Assault gets its own category; everything else is “Random Battles”. Open this section to add your own keyword → label rules, for example for Arcade or event modes.' },
    { target: '#overallStats', title: '4 · Results',
      hiddenText: 'This area fills in after you click Analyze: total matches, win rate, net SL and RP, then a split by battle type.',
      text: 'Overall totals for the matches in this session, followed by a table splitting them by battle type.' },
    { target: '#goalCalcSection', title: '5 · Goal calculator',
      hiddenText: 'After Analyze, the goal calculator appears here.',
      text: 'Estimates how many matches you need to reach an RP or SL goal, based on your own win and loss averages. Choose which battle type to load averages from, enter what you still need, and toggle the +30% RP booster if you use one.' },
    { target: '.match-table-wrap', title: '6 · Per-match detail',
      hiddenText: 'After Analyze, every match is listed here. Duplicates are struck through and left out of all totals.',
      text: 'Every match in the session. Duplicates are struck through and excluded from all totals. “RP by Research Target” above counts RP toward new vehicles; module and research-progress RP is kept separate under “Other RP”.' },
    { target: '.controls', title: '7 · Export and import',
      text: '“Export HTML” makes a printable report. “Minimal export” saves a compact summary file. “Export Raw” saves the original match text from your local archive — that is your backup, and it keeps all detail. “Import Report” accepts any of these files, plus plain .txt logs.' },
    { target: '.view-link', title: '8 · Advanced view',
      text: 'Every match you analyze is also saved, compressed, in this browser. The Advanced view opens that archive: click a match for its full breakdown (kills, assists, awards, per-vehicle numbers, costs), compare maps and vehicles, and manage storage. It has a link back here.' },
    { title: 'You’re set',
      text: 'Tip: the local archive lives only in this browser on this device. Use “Export Raw” now and then so you never lose your history. Reopen this tour any time from “? Tutorial”.' }
  ],
  advanced: [
    { title: 'Welcome to the Advanced view',
      text: 'This view is built from the match archive saved in your browser: every match you analyze in the Basic view is stored automatically. Here you can open any match in detail, compare maps and vehicles, and manage or back up the archive. The “← Basic view” link takes you back to the regular view at any time.' },
    { target: '.filter-bar', title: '1 · Filter and sort',
      hiddenText: 'Once the archive has matches, filters appear here.',
      text: 'Search by mission, category or target, narrow to a battle type or to wins/losses, change the sort order, or show only matches that have stored detail. The totals below update to match.' },
    { target: '#libTable', title: '2 · Open a match',
      hiddenText: 'Once the archive has matches, they are listed here. Rows with a ● have full detail.',
      text: 'Click any row marked ● to open its breakdown. Rows marked ○ are summary-only (they came from a minimal export or HTML report, which don’t contain the original text).' },
    { target: '#detailSection', title: '3 · Match detail',
      hiddenText: 'Opening a match shows: net and earned SL with repair/ammo costs, a per-vehicle table, every scoring event (time, weapon, target, SL and RP — hover an amount for the base/premium/booster split), flat rewards, research and the raw log text. Esc closes it.',
      text: 'The full breakdown of the selected match. Hover an SL or RP amount to see its base, premium-account and booster parts. You can copy the raw text, export just this match, or delete it from the archive.' },
    { target: '#insightsSection', title: '4 · Insights',
      hiddenText: 'Once the archive has matches, insights by map, vehicle and event type appear here.',
      text: 'Stats across the whole archive: results by map, time and kills per vehicle, and which kinds of events earn the most SL and RP. Vehicle and event tables only use matches with stored detail.' },
    { target: '#storageSection', title: '5 · Storage and backups',
      text: 'Shows how much the archive uses and how well it compresses. “Export raw” downloads the original match text (.json.gz is the smallest) — re-importing it rebuilds everything, even as the tool improves. You can also import plain log text, or delete the whole archive. Remember: it lives only in this browser, so back it up.' },
    { target: '#basicLink', title: '6 · Back to Basic',
      text: 'Use this link to return to the regular view whenever you like. Your archive and settings are shared between both views.' },
    { title: 'You’re set',
      text: 'Reopen this tour any time from “? Tutorial”.' }
  ]
};

const Tutorial = (() => {
  const isShown = el => !!el && el.getClientRects().length > 0;
  let state = null; // { steps, i, page, nodes, onKey, onReflow }

  function build() {
    const backdrop = document.createElement('div');
    backdrop.className = 'tut-backdrop';
    const spot = document.createElement('div');
    spot.className = 'tut-spot';
    const card = document.createElement('div');
    card.className = 'tut-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tutTitle');
    card.innerHTML = `
      <div class="tut-step" id="tutStep"></div>
      <h2 class="tut-title" id="tutTitle"></h2>
      <p class="tut-text" id="tutText"></p>
      <div class="tut-actions">
        <button type="button" class="secondary small" id="tutSkip">Skip tour</button>
        <span class="tut-spacer"></span>
        <button type="button" class="secondary small" id="tutBack">Back</button>
        <button type="button" class="small" id="tutNext">Next</button>
      </div>`;
    document.body.append(backdrop, spot, card);
    return { backdrop, spot, card };
  }

  function place() {
    if (!state) return;
    const { spot, card } = state.nodes;
    const step = state.steps[state.i];
    const target = step.target ? document.querySelector(step.target) : null;
    const visible = isShown(target);

    if (!visible) {
      spot.style.display = 'none';
      card.style.top = '50%'; card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const pad = 6;
    const r = target.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.left = (r.left - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';

    // Card goes below the target if it fits, else above, else centred over it.
    card.style.transform = 'none';
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top;
    if (r.bottom + gap + ch <= vh) top = r.bottom + gap;
    else if (r.top - gap - ch >= 0) top = r.top - gap - ch;
    else top = Math.max(12, Math.min(vh - ch - 12, r.top + 16));
    let left = Math.max(12, Math.min(vw - cw - 12, r.left));
    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }

  function show(i) {
    const step = state.steps[i];
    state.i = i;
    const target = step.target ? document.querySelector(step.target) : null;
    const visible = isShown(target);

    document.getElementById('tutStep').textContent = `Step ${i + 1} of ${state.steps.length}`;
    document.getElementById('tutTitle').textContent = step.title;
    document.getElementById('tutText').textContent = (!visible && step.hiddenText) ? step.hiddenText : step.text;
    const last = i === state.steps.length - 1;
    document.getElementById('tutBack').style.visibility = i === 0 ? 'hidden' : 'visible';
    document.getElementById('tutNext').textContent = last ? 'Done' : 'Next';
    document.getElementById('tutSkip').style.visibility = last ? 'hidden' : 'visible';

    if (visible) target.scrollIntoView({ block: 'center', behavior: 'auto' });
    place();
    document.getElementById('tutNext').focus({ preventScroll: true });
  }

  function end() {
    if (!state) return;
    saveState('tutorialSeen.' + state.page, true);
    window.removeEventListener('keydown', state.onKey, true);
    window.removeEventListener('resize', state.onReflow);
    window.removeEventListener('scroll', state.onReflow, true);
    Object.values(state.nodes).forEach(n => n.remove());
    const opener = state.opener;
    state = null;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  function start(page) {
    if (state) return;
    const steps = TUTORIAL_STEPS[page];
    if (!steps) return;
    const nodes = build();
    state = { steps, i: 0, page, nodes, opener: document.activeElement };

    let raf = 0;
    state.onReflow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    state.onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog while it is open.
        const f = [...nodes.card.querySelectorAll('button')].filter(b => b.style.visibility !== 'hidden');
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (!nodes.card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', state.onKey, true);
    window.addEventListener('resize', state.onReflow);
    window.addEventListener('scroll', state.onReflow, true);

    const next = () => { if (state.i >= steps.length - 1) end(); else show(state.i + 1); };
    const back = () => { if (state.i > 0) show(state.i - 1); };
    document.getElementById('tutNext').addEventListener('click', next);
    document.getElementById('tutBack').addEventListener('click', back);
    document.getElementById('tutSkip').addEventListener('click', end);
    nodes.backdrop.addEventListener('click', end);
    show(0);
  }

  function init() {
    const page = document.body.dataset.page;
    const btn = document.getElementById('tutorialBtn');
    if (btn) btn.addEventListener('click', () => start(page));
    if (TUTORIAL_STEPS[page] && !loadState('tutorialSeen.' + page, false)) setTimeout(() => start(page), 500);
  }

  return { start, init };
})();

Tutorial.init();
