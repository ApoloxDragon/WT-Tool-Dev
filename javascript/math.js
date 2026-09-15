/* ---------- Pure stat & goal math (no DOM access) ---------- */

function computeCategoryStats(matches, filterFn) {
  const ms = matches.filter(filterFn);
  const w = ms.filter(m => m.result === 'Victory');
  const l = ms.filter(m => m.result === 'Defeat');
  const sl = ms.reduce((a, m) => a + m.netSL, 0);
  const rp = ms.reduce((a, m) => a + m.totalRP, 0);
  const avgWin = w.length ? (w.reduce((a, m) => a + m.netSL, 0) / w.length) : 0;
  const avgLoss = l.length ? (l.reduce((a, m) => a + m.netSL, 0) / l.length) : 0;
  const avgWinRP = w.length ? (w.reduce((a, m) => a + m.totalRP, 0) / w.length) : 0;
  const avgLossRP = l.length ? (l.reduce((a, m) => a + m.totalRP, 0) / l.length) : 0;
  const avgWinTime = w.length ? (w.reduce((a, m) => a + (m.timeSec||0), 0) / w.length) : 0;
  const avgLossTime = l.length ? (l.reduce((a, m) => a + (m.timeSec||0), 0) / l.length) : 0;
  return {
    count: ms.length, w: w.length, l: l.length, wr: ms.length ? (w.length/ms.length*100) : 0, sl, rp,
    avgWin, avgLoss, avgWinRP, avgLossRP, avgWinTime, avgLossTime
  };
}

function computeGoalMath({ winRatePct, avgWinRP, avgLossRP, avgWinSL, avgLossSL, rpGoal, slGoal, boosterActive, avgWinTime, avgLossTime }) {
  const wrFrac = winRatePct / 100;
  const boosterMult = boosterActive ? 1.3 : 1;
  const expRP = (wrFrac * avgWinRP + (1 - wrFrac) * avgLossRP) * boosterMult;
  const expSL = wrFrac * avgWinSL + (1 - wrFrac) * avgLossSL;
  const expTimeSec = wrFrac * avgWinTime + (1 - wrFrac) * avgLossTime;

  const matchesRP = (rpGoal > 0 && expRP > 0) ? Math.ceil(rpGoal / expRP) : null;
  const matchesSL = (slGoal > 0 && expSL > 0) ? Math.ceil(slGoal / expSL) : null;

  let bottleneckMatches = null, bottleneckLabel = '';
  if (matchesRP !== null || matchesSL !== null) {
    bottleneckMatches = Math.max(matchesRP || 0, matchesSL || 0);
    if (matchesRP !== null && matchesSL !== null) {
      bottleneckLabel = matchesRP === matchesSL ? 'RP & SL tied' : (matchesRP > matchesSL ? 'RP-bound' : 'SL-bound');
    } else {
      bottleneckLabel = matchesRP !== null ? 'RP-bound' : 'SL-bound';
    }
  }

  const totalTimeHrs = bottleneckMatches ? (bottleneckMatches * expTimeSec / 3600) : 0;

  return { expRP, expSL, expTimeSec, matchesRP, matchesSL, bottleneckMatches, bottleneckLabel, totalTimeHrs };
}

function formatTime(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
