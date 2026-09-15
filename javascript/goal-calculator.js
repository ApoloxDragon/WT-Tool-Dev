/* ---------- Goal calculator ---------- */
// Depends on: lastCategoryStats (main.js), computeGoalMath/formatTime (math.js).
let goalTimeAvgs = { avgWinTime: 0, avgLossTime: 0 };
let boosterActive = false;

function loadGoalFieldsFromCategory(catKey) {
  const stats = lastCategoryStats && lastCategoryStats[catKey];
  if (!stats) return;
  document.getElementById('goalWinRate').value = stats.wr.toFixed(1);
  document.getElementById('goalAvgWinRP').value = Math.round(stats.avgWinRP);
  document.getElementById('goalAvgLossRP').value = Math.round(stats.avgLossRP);
  document.getElementById('goalAvgWinSL').value = Math.round(stats.avgWin);
  document.getElementById('goalAvgLossSL').value = Math.round(stats.avgLoss);
  goalTimeAvgs = { avgWinTime: stats.avgWinTime, avgLossTime: stats.avgLossTime };
}

function computeGoalOutputs() {
  const out = document.getElementById('goalOutput');
  if (!lastCategoryStats) { out.innerHTML = ''; return; }

  const wr = parseFloat(document.getElementById('goalWinRate').value) || 0;
  const avgWinRP = parseFloat(document.getElementById('goalAvgWinRP').value) || 0;
  const avgLossRP = parseFloat(document.getElementById('goalAvgLossRP').value) || 0;
  const avgWinSL = parseFloat(document.getElementById('goalAvgWinSL').value) || 0;
  const avgLossSL = parseFloat(document.getElementById('goalAvgLossSL').value) || 0;
  const rpGoal = parseFloat(document.getElementById('goalRpTarget').value) || 0;
  const slGoal = parseFloat(document.getElementById('goalSlTarget').value) || 0;

  const { expRP, expSL, expTimeSec, matchesRP, matchesSL, bottleneckMatches, bottleneckLabel, totalTimeHrs } = computeGoalMath({
    winRatePct: wr, avgWinRP, avgLossRP, avgWinSL, avgLossSL, rpGoal, slGoal, boosterActive,
    avgWinTime: goalTimeAvgs.avgWinTime, avgLossTime: goalTimeAvgs.avgLossTime
  });

  const heroHtml = `
    <div class="goal-hero">
      <div class="goal-hero-num">${bottleneckMatches !== null ? bottleneckMatches.toLocaleString() : '—'}</div>
      <div class="goal-hero-lbl">matches needed${bottleneckLabel ? ' · ' + bottleneckLabel : ''}</div>
    </div>`;

  const rows = [
    ['Expected RP / match', Math.round(expRP).toLocaleString() + (boosterActive ? ' (+30% applied)' : '')],
    ['Expected net SL / match', Math.round(expSL).toLocaleString()],
    ['Expected time / match', formatTime(expTimeSec)],
    ['Matches needed — RP goal', matchesRP !== null ? matchesRP.toLocaleString() : '—'],
    ['Matches needed — SL goal', matchesSL !== null ? matchesSL.toLocaleString() : '—'],
    ['Est. active playtime', bottleneckMatches ? totalTimeHrs.toFixed(1) + ' hrs' : '—']
  ];
  out.innerHTML = heroHtml + rows.map(([lbl, val]) =>
    `<div class="goal-result-row"><span>${lbl}</span><span class="goal-result-val">${val}</span></div>`
  ).join('');
}

document.getElementById('goalCategory').addEventListener('change', (e) => {
  loadGoalFieldsFromCategory(e.target.value);
  computeGoalOutputs();
});
document.getElementById('boosterToggle').addEventListener('click', (e) => {
  boosterActive = !boosterActive;
  e.target.classList.toggle('active', boosterActive);
  computeGoalOutputs();
});
['goalWinRate', 'goalAvgWinRP', 'goalAvgLossRP', 'goalAvgWinSL', 'goalAvgLossSL', 'goalRpTarget', 'goalSlTarget'].forEach(id => {
  document.getElementById(id).addEventListener('input', computeGoalOutputs);
});
