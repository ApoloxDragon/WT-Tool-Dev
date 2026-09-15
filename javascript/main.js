/* ---------- App state ---------- */
let lastMatches = null; // cache for export
let lastCategoryStats = null; // cache for goal calculator
let importedMatches = []; // matches loaded from a previously exported report

/* ---------- Analyze ---------- */
// Depends on: parseLog (parser.js), computeCategoryStats (math.js),
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

  lastCategoryStats = {};
  categories.forEach(cat => { lastCategoryStats[cat] = computeCategoryStats(matches, m => m.category === cat); });
  lastCategoryStats['All Combined'] = computeCategoryStats(matches, () => true);

  const splitRows = categories.map(cat => {
    const s = lastCategoryStats[cat];
    return `<tr>
      <td>${cat}</td>
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
  goalCatSelect.innerHTML = catKeys.map(c => `<option value="${c}">${c}</option>`).join('');
  goalCatSelect.value = 'All Combined';
  loadGoalFieldsFromCategory('All Combined');
  computeGoalOutputs();

  const targetMap = {};
  matches.forEach(m => m.researched.forEach(r => {
    targetMap[r.name] = (targetMap[r.name] || 0) + r.rp;
  }));
  const targetRows = Object.entries(targetMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, rp]) => `<tr><td>${name}</td><td class="num">${rp.toLocaleString()}</td></tr>`).join('');
  document.getElementById('targetTable').innerHTML = `
    <tr><th>Target</th><th class="num">RP Earned</th></tr>
    ${targetRows || '<tr><td colspan="2" class="note">No research targets found</td></tr>'}`;

  const progressMap = {};
  matches.forEach(m => (m.researching || []).forEach(r => {
    progressMap[r.name] = (progressMap[r.name] || 0) + r.rp;
  }));
  const progressRows = Object.entries(progressMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, rp]) => `<tr><td>${name}</td><td class="num">${rp.toLocaleString()}</td></tr>`).join('');
  document.getElementById('progressTable').innerHTML = `
    <tr><th>Module / progress</th><th class="num">RP Earned</th></tr>
    ${progressRows || '<tr><td colspan="2" class="note">No research progress entries found</td></tr>'}`;

  const matchRows = all.map(m => {
    const isDupe = matches.indexOf(m) === -1;
    // Duplicates are excluded from every total, so their SL/RP/target figures are
    // blanked out here too — showing the real numbers next to a struck-through row
    // reads as double-counted RP even though it isn't included anywhere.
    const target = isDupe ? '—' : m.researched.map(r => `${r.name} (+${r.rp.toLocaleString()})`).join(', ');
    const resultClass = m.result === 'Victory' ? 'win' : 'loss';
    return `<tr class="${resultClass}${isDupe ? ' dupe' : ''}">
      <td class="result">${m.result}</td>
      <td>${m.category}</td>
      <td>${m.mode !== m.category ? m.mode : ''}</td>
      <td>${m.mission}</td>
      <td class="num">${isDupe ? '—' : m.netSL.toLocaleString()}</td>
      <td class="num">${isDupe ? '—' : m.totalRP.toLocaleString()}</td>
      <td>${target}</td>
      <td>${isDupe ? 'DUPLICATE — excluded' : ''}</td>
    </tr>`;
  }).join('');
  document.getElementById('matchTable').innerHTML = `
    <tr><th>Result</th><th>Category</th><th>Sub-mode</th><th>Mission</th>
        <th class="num">Net SL</th><th class="num">RP</th><th>Target(s)</th><th></th></tr>
    ${matchRows}`;
}

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('input').value = '';
  document.getElementById('results').style.display = 'none';
  document.getElementById('dupeWarn').style.display = 'none';
  lastMatches = null;
  lastCategoryStats = null;
  importedMatches = [];
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
      importNote.textContent = '';
      analyze();
    })
    .catch(() => {
      importNote.textContent = 'Could not load example data — if you opened this file directly from disk (file://), browsers block that fetch; open the hosted version or run a local server instead.';
    });
});
