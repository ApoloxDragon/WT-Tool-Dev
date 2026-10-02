/* ---------- App state ---------- */
let lastMatches = null; // cache for export
let lastCategoryStats = null; // cache for goal calculator
let importedMatches = loadState('importedMatches', [], sanitizeMatchList); // matches loaded from a previously exported report

/* ---------- Local archive ---------- */
// Every pasted match's raw text is kept (compressed) in the browser so the
// Advanced view can show per-match detail later. Clear only resets the current
// session — the archive is managed from the Advanced view's storage panel.
// Depends on: WtDB (db.js), archiveParsedMatches/trackArchiveWrite (raw-export.js).
async function archiveMatches(matches) {
  const note = document.getElementById('archiveNote');
  const fresh = matches.filter(m => m.raw && !m.sessionId.startsWith('noid-'));
  if (fresh.length === 0) return;
  const { added } = await archiveParsedMatches(fresh);
  if (await WtDB.backendName() === 'none') {
    note.textContent = 'Local archive unavailable in this browser — Advanced view detail won\'t be saved.';
    return;
  }
  const total = (await WtDB.ids()).length;
  note.textContent = `Local archive: ${total} match(es) stored` + (added ? ` (${added} new).` : '.');
  WtDB.requestPersistence();
}

// Saving to the archive is a bonus. Whatever goes wrong with it — storage blocked or full, a part of
// the page that didn't load — the analysis the user asked for has already happened and must stand.
function archiveInBackground(matches) {
  const job = archiveMatches(matches).catch(() => {});
  if (typeof trackArchiveWrite === 'function') trackArchiveWrite(job);
}

/* ---------- The per-match table (shows a first batch; the rest on request) ---------- */
// Building a row for every match is what made big sessions slow: 2,000 matches meant ~18,000 page
// elements, and every theme switch or layout change had to re-style all of them. Only the rows on
// screen matter, so show the first batch and let the user ask for more. Exports use the data, not
// these rows, and printing shows everything (see beforeprint below).
const MATCH_ROWS_FIRST = 200, MATCH_ROWS_MORE = 500;
let matchRowItems = [];            // [[match, isDuplicate], …] for the whole session
let matchRowsShown = MATCH_ROWS_FIRST;

function matchRowHtml([m, isDupe]) {
  // Duplicates are excluded from every total, so their SL/RP/target figures are
  // blanked out here too — showing the real numbers next to a struck-through row
  // reads as double-counted RP even though it isn't included anywhere.
  const target = isDupe ? '—' : m.researched.map(r => `${esc(r.name)} (+${r.rp.toLocaleString()})`).join(', ');
  const resultClass = m.result === 'Victory' ? 'win' : 'loss';
  return `<tr class="${resultClass}${isDupe ? ' dupe' : ''}">
      <td class="result">${esc(m.result)}</td>
      <td>${esc(m.category)}</td>
      <td>${m.mode !== m.category ? esc(m.mode) : ''}</td>
      <td>${esc(m.mission)}</td>
      <td class="num">${isDupe ? '—' : m.netSL.toLocaleString()}</td>
      <td class="num">${isDupe ? '—' : m.totalRP.toLocaleString()}</td>
      <td>${target}</td>
      <td>${isDupe ? 'DUPLICATE — excluded' : ''}</td>
    </tr>`;
}

function renderMatchRows() {
  const total = matchRowItems.length;
  const shown = Math.min(matchRowsShown, total);
  document.getElementById('matchTable').innerHTML = `
    <tr><th>Result</th><th>Category</th><th>Sub-mode</th><th>Mission</th>
        <th class="num">Net SL</th><th class="num">RP</th><th>Target(s)</th><th></th></tr>
    ${matchRowItems.slice(0, shown).map(matchRowHtml).join('')}`;
  const more = document.getElementById('matchTableMore');
  more.textContent = '';
  if (shown < total) {
    more.append(`Showing the first ${shown.toLocaleString()} of ${total.toLocaleString()} matches. `);
    const step = Math.min(MATCH_ROWS_MORE, total - shown);
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.textContent = label; b.addEventListener('click', fn); return b; };
    more.append(mk(`Show ${step.toLocaleString()} more`, () => { matchRowsShown += MATCH_ROWS_MORE; renderMatchRows(); }), ' ',
      mk(`Show all ${total.toLocaleString()}`, expandAllMatchRows));
  }
}
function expandAllMatchRows() { matchRowsShown = Math.max(matchRowItems.length, MATCH_ROWS_FIRST); renderMatchRows(); }
window.addEventListener('beforeprint', () => { if (matchRowsShown < matchRowItems.length) expandAllMatchRows(); }); // a printout must have every match

/* ---------- Analyze ---------- */
// Depends on: esc (util.js), parseLog (parser.js), computeCategoryStats (math.js),
// loadGoalFieldsFromCategory/computeGoalOutputs (goal-calculator.js).
function analyze() {
  const raw = document.getElementById('input').value;
  const freshlyParsed = parseLog(raw);
  const all = [...importedMatches, ...freshlyParsed];
  const emptyState = document.getElementById('emptyState');
  const results = document.getElementById('results');
  const dupeWarn = document.getElementById('dupeWarn');

  if (all.length === 0) {
    emptyState.style.display = 'block';
    emptyState.textContent = 'No matches recognized in that text — check the log includes "Victory/Defeat in the [...] mission!" lines.';
    results.style.display = 'none';
    dupeWarn.style.display = 'none';
    lastMatches = null;
    return;
  }

  const seen = new Set();
  let dupeCount = 0;
  const matches = all.filter(m => {
    if (m.sessionId.startsWith('noid-')) return true;
    if (seen.has(m.sessionId)) { dupeCount++; return false; }
    seen.add(m.sessionId);
    return true;
  });

  if (dupeCount > 0) {
    dupeWarn.style.display = 'block';
    dupeWarn.textContent = `⚠ ${dupeCount} duplicate match(es) detected by Session ID and excluded from totals.`;
  } else {
    dupeWarn.style.display = 'none';
  }

  emptyState.style.display = 'none';
  results.style.display = 'block';
  lastMatches = { all, matches };
  archiveInBackground(freshlyParsed);

  const wins = matches.filter(m => m.result === 'Victory');
  const totalSL = matches.reduce((a, m) => a + m.netSL, 0);
  const totalRP = matches.reduce((a, m) => a + m.totalRP, 0);
  const winRate = matches.length ? (wins.length / matches.length * 100) : 0;

  document.getElementById('overallStats').innerHTML = [
    ['MATCHES', matches.length],
    ['WIN RATE', winRate.toFixed(1) + '%'],
    ['TOTAL NET SL', totalSL.toLocaleString()],
    ['TOTAL RP', totalRP.toLocaleString()]
  ].map(([lbl, num]) => `<div class="stat-cell"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');

  const categories = [...new Set(matches.map(m => m.category))];

  lastCategoryStats = Object.create(null); // keyed by names from the log: no inherited keys like "constructor"
  categories.forEach(cat => { lastCategoryStats[cat] = computeCategoryStats(matches, m => m.category === cat); });
  lastCategoryStats['All Combined'] = computeCategoryStats(matches, () => true);

  const splitRows = categories.map(cat => {
    const s = lastCategoryStats[cat];
    return `<tr>
      <td>${esc(cat)}</td>
      <td class="num">${s.count}</td>
      <td class="num">${s.w}/${s.l}</td>
      <td class="num">${s.wr.toFixed(1)}%</td>
      <td class="num">${s.sl.toLocaleString()}</td>
      <td class="num">${Math.round(s.avgWin).toLocaleString()}</td>
      <td class="num">${Math.round(s.avgLoss).toLocaleString()}</td>
      <td class="num">${s.rp.toLocaleString()}</td>
    </tr>`;
  }).join('');

  document.getElementById('splitTable').innerHTML = `
    <tr><th>Battle Type</th><th class="num">Matches</th><th class="num">W/L</th><th class="num">Win%</th>
        <th class="num">Total Net SL</th><th class="num">Avg Win SL</th><th class="num">Avg Loss SL</th><th class="num">Total RP</th></tr>
    ${splitRows}`;

  const goalCatSelect = document.getElementById('goalCategory');
  const catKeys = [...categories, 'All Combined'];
  goalCatSelect.innerHTML = catKeys.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  goalCatSelect.value = 'All Combined';
  loadGoalFieldsFromCategory('All Combined');
  computeGoalOutputs();

  const targetMap = Object.create(null);
  matches.forEach(m => m.researched.forEach(r => {
    targetMap[r.name] = (targetMap[r.name] || 0) + r.rp;
  }));
  const targetRows = Object.entries(targetMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, rp]) => `<tr><td>${esc(name)}</td><td class="num">${rp.toLocaleString()}</td></tr>`).join('');
  document.getElementById('targetTable').innerHTML = `
    <tr><th>Target</th><th class="num">RP Earned</th></tr>
    ${targetRows || '<tr><td colspan="2" class="note">No research targets found</td></tr>'}`;

  const progressMap = Object.create(null);
  matches.forEach(m => (m.researching || []).forEach(r => {
    progressMap[r.name] = (progressMap[r.name] || 0) + r.rp;
  }));
  const progressRows = Object.entries(progressMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, rp]) => `<tr><td>${esc(name)}</td><td class="num">${rp.toLocaleString()}</td></tr>`).join('');
  document.getElementById('progressTable').innerHTML = `
    <tr><th>Module / progress</th><th class="num">RP Earned</th></tr>
    ${progressRows || '<tr><td colspan="2" class="note">No research progress entries found</td></tr>'}`;

  const kept = new Set(matches); // a Set: indexOf() here made the table O(n²) for big sessions
  matchRowItems = all.map(m => [m, !kept.has(m)]);
  matchRowsShown = MATCH_ROWS_FIRST;
  renderMatchRows();
}

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('input').value = '';
  document.getElementById('results').style.display = 'none';
  document.getElementById('dupeWarn').style.display = 'none';
  lastMatches = null;
  lastCategoryStats = null;
  matchRowItems = [];
  document.getElementById('matchTableMore').textContent = '';
  importedMatches = [];
  clearState('importedMatches');
  clearState('inputText');
  document.getElementById('importNote').textContent = '';
  boosterActive = false;
  document.getElementById('boosterToggle').classList.remove('active');
  ['goalWinRate','goalAvgWinRP','goalAvgLossRP','goalAvgWinSL','goalAvgLossSL','goalRpTarget','goalSlTarget'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('goalOutput').innerHTML = '';
  document.getElementById('goalCategory').innerHTML = '';
  const emptyState = document.getElementById('emptyState');
  emptyState.style.display = 'block';
  emptyState.textContent = 'No data yet — paste a log and hit Analyze.';
});

document.getElementById('loadExampleBtn').addEventListener('click', () => {
  const importNote = document.getElementById('importNote');
  fetch('example%20data/matches.txt')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      document.getElementById('input').value = text;
      saveState('inputText', text);
      importNote.textContent = '';
      // analyze() is outside the fetch's error handling on purpose: a problem analysing the text
      // must not be reported as "couldn't download it".
      try { analyze(); }
      catch (err) { importNote.textContent = 'The example loaded, but analysing it failed: ' + err.message; }
    }, () => {
      importNote.textContent = 'Could not load example data — if you opened this file directly from disk (file://), browsers block that fetch; open the hosted version or run a local server instead.';
    });
});

/* ---------- Session persistence ---------- */
// Restore whatever was pasted last time, debounced so we're not writing to
// localStorage on every keystroke of a multi-thousand-line paste.
let inputSaveTimer = null;
document.getElementById('input').addEventListener('input', (e) => {
  clearTimeout(inputSaveTimer);
  inputSaveTimer = setTimeout(() => saveState('inputText', e.target.value), 300);
});

const savedInput = loadState('inputText', '', v => (typeof v === 'string' ? v : undefined));
if (savedInput) document.getElementById('input').value = savedInput;
if (savedInput || importedMatches.length > 0) analyze();

// Everything above has run: the page is usable. (load-guard.js watches for this to clear its "still loading" note.)
window.__wtReady = true;
document.dispatchEvent(new Event('wt-ready'));
