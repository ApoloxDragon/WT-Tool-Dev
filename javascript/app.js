/* ---------- Theme system ---------- */
const THEMES = {
  blue:   { bg:'#0d1420', panel:'#131b2b', panel2:'#182338', border:'#26344d', accent:'#4d9fe8', text:'#dbe6f2', dim:'#6f8299' },
  amber:  { bg:'#12130d', panel:'#1a1c14', panel2:'#21231a', border:'#3a3c2c', accent:'#d9a441', text:'#e8e4d5', dim:'#8b8d78' },
  slate:  { bg:'#16181c', panel:'#1e2126', panel2:'#262a30', border:'#383d44', accent:'#c9ced6', text:'#e4e7ea', dim:'#7d848d' },
  forest: { bg:'#0f1712', panel:'#16211a', panel2:'#1c2921', border:'#2e402f', accent:'#6bbf7a', text:'#dcead9', dim:'#7b9a80' }
};
let currentTheme = 'blue';

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--panel', t.panel);
  root.setProperty('--panel-2', t.panel2);
  root.setProperty('--border', t.border);
  root.setProperty('--accent', t.accent);
  root.setProperty('--text', t.text);
  root.setProperty('--dim', t.dim);
  currentTheme = name;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === name));
}

function buildThemePicker() {
  const picker = document.getElementById('themePicker');
  Object.entries(THEMES).forEach(([name, t]) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (name === currentTheme ? ' active' : '');
    btn.style.background = t.accent;
    btn.dataset.theme = name;
    btn.title = name;
    btn.addEventListener('click', () => applyTheme(name));
    picker.appendChild(btn);
  });
}
buildThemePicker();

/* ---------- Category rules ---------- */
// Each rule: { keyword, label }. First match (case-insensitive substring) wins.
// Anything unmatched falls back to "Random Battles".
let categoryRules = [
  { keyword: 'Tank Assault', label: 'Tank Assault' }
];

function classify(modeBase) {
  for (const rule of categoryRules) {
    if (modeBase.toLowerCase().includes(rule.keyword.toLowerCase())) return rule.label;
  }
  return 'Random Battles';
}

function renderRules() {
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  categoryRules.forEach((rule, idx) => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.innerHTML = `
      <input type="text" value="${rule.keyword}" data-idx="${idx}" data-field="keyword">
      <input type="text" value="${rule.label}" data-idx="${idx}" data-field="label">
      <button class="remove" data-idx="${idx}">Remove</button>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      categoryRules[idx][e.target.dataset.field] = e.target.value;
    });
  });
  list.querySelectorAll('button.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      categoryRules.splice(+e.target.dataset.idx, 1);
      renderRules();
    });
  });
}
renderRules();

document.getElementById('addRuleBtn').addEventListener('click', () => {
  const kw = document.getElementById('newKeyword').value.trim();
  const lbl = document.getElementById('newLabel').value.trim();
  if (!kw || !lbl) return;
  categoryRules.push({ keyword: kw, label: lbl });
  document.getElementById('newKeyword').value = '';
  document.getElementById('newLabel').value = '';
  renderRules();
});

/* ---------- Parsing ---------- */
function parseLog(text) {
  text = text.replace(/\r\n/g, '\n');
  const headerRegex = /(Victory|Defeat) in the \[([^\]]+)\]\s+(.+?)\s+mission!/g;
  const headers = [];
  let m;
  while ((m = headerRegex.exec(text)) !== null) {
    headers.push({ index: m.index, result: m[1], modeRaw: m[2].trim(), mission: m[3].trim() });
  }

  const matches = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const block = text.slice(start, end);

    const sessionMatch = block.match(/Session:\s*([a-f0-9]+)/i);
    const sessionId = sessionMatch ? sessionMatch[1] : ('noid-' + i);

    const timeMatch = block.match(/Time Played\s+(\d+):(\d+)/);
    const timeSec = timeMatch ? (parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])) : 0;

    const totalRegex = /Total:\s*([\d,]+)\s*SL,\s*([\d,]+)\s*CRP,\s*([\d,]+)\s*RP/g;
    let tm, lastTotal = null;
    while ((tm = totalRegex.exec(block)) !== null) lastTotal = tm;
    const netSL = lastTotal ? parseInt(lastTotal[1].replace(/,/g, '')) : 0;
    // The trailing "RP" figure on the Total: line is CRP + Researching progress
    // added together — the same battle RP counted a second time toward whatever
    // module is being researched on another vehicle. CRP alone is what the match
    // actually earned, so that's what "Total RP" means everywhere in this tool.
    const totalRP = lastTotal ? parseInt(lastTotal[2].replace(/,/g, '')) : 0;

    // "Researched unit" is RP that went toward unlocking a whole new vehicle —
    // that's the only thing shown by default. "Researching progress" is RP toward
    // a module/modification on a vehicle already owned; it's real RP (it's part of
    // Total RP) but isn't "vehicle RP", so it's kept separate for the toggle-able
    // Other RP table instead of being mixed into the main target breakdown.
    function extractTargets(marker, stopWords) {
      const idx = block.indexOf(marker);
      if (idx === -1) return [];
      const after = block.slice(idx + marker.length);
      let stop = after.length;
      stopWords.forEach(w => {
        const wIdx = after.indexOf(w);
        if (wIdx !== -1 && wIdx < stop) stop = wIdx;
      });
      const section = after.slice(0, stop);
      const lineRe = /([A-Za-z0-9À-ÿ'".\-() ]+?):\s*([\d,]+)\s*RP/g;
      const out = [];
      let lm;
      while ((lm = lineRe.exec(section)) !== null) {
        const name = lm[1].trim();
        const rp = parseInt(lm[2].replace(/,/g, ''));
        if (name && rp) out.push({ name, rp });
      }
      return out;
    }
    const researched = extractTargets('Researched unit:', ['Researching progress:', 'Used items:', 'Session:']);
    const researching = extractTargets('Researching progress:', ['Used items:', 'Session:']);

    const modeBase = headers[i].modeRaw.replace(/\s*#\d+$/, '').trim();
    const category = classify(modeBase);

    matches.push({
      result: headers[i].result, mode: modeBase, category,
      mission: headers[i].mission, sessionId, netSL, totalRP, researched, researching, timeSec
    });
  }
  return matches;
}

let lastMatches = null; // cache for export
let lastCategoryStats = null; // cache for goal calculator
let importedMatches = []; // matches loaded from a previously exported report

/* ---------- Analyze ---------- */
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
  function catStats(filterFn) {
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

  lastCategoryStats = {};
  categories.forEach(cat => { lastCategoryStats[cat] = catStats(m => m.category === cat); });
  lastCategoryStats['All Combined'] = catStats(() => true);

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

/* ---------- Goal calculator ---------- */
let goalTimeAvgs = { avgWinTime: 0, avgLossTime: 0 };
let boosterActive = false;

function formatTime(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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

  const wrFrac = wr / 100;
  const boosterMult = boosterActive ? 1.3 : 1;
  const expRP = (wrFrac * avgWinRP + (1 - wrFrac) * avgLossRP) * boosterMult;
  const expSL = wrFrac * avgWinSL + (1 - wrFrac) * avgLossSL;
  const expTimeSec = wrFrac * goalTimeAvgs.avgWinTime + (1 - wrFrac) * goalTimeAvgs.avgLossTime;

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

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const importNote = document.getElementById('importNote');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const raw = ev.target.result;
    const existingIds = new Set(importedMatches.map(m => m.sessionId));
    let added = 0, skipped = 0;
    const addMatch = (match) => {
      if (existingIds.has(match.sessionId)) { skipped++; return; }
      importedMatches.push(match);
      existingIds.add(match.sessionId);
      added++;
    };

    // Try the minimal JSON format first (short keys: id, r, c, m, sl, rp, t, tg).
    let handledAsJson = false;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        handledAsJson = true;
        parsed.forEach(entry => {
          if (!entry || !entry.id) return;
          addMatch({
            sessionId: entry.id,
            result: entry.r === 'W' ? 'Victory' : 'Defeat',
            category: entry.c || 'Random Battles',
            mode: entry.c || 'Random Battles',
            mission: entry.m || '',
            netSL: entry.sl || 0,
            totalRP: entry.rp || 0,
            timeSec: entry.t || 0,
            researched: (entry.tg || []).map(x => ({ name: x.n, rp: x.v }))
          });
        });
      }
    } catch (err) { /* not JSON — fall through to HTML parsing below */ }

    if (!handledAsJson) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'text/html');
        const rows = doc.querySelectorAll('tr[data-session]');
        if (rows.length === 0) {
          importNote.textContent = 'No importable match data found — is that a report or data file exported from this tool?';
          return;
        }
        rows.forEach(row => {
          const sessionId = row.dataset.session;
          const timeSec = parseInt(row.dataset.time) || 0;
          const cells = row.querySelectorAll('td');
          const result = cells[0].textContent.trim();
          const category = cells[1].textContent.trim();
          const modeCell = cells[2].textContent.trim();
          const mode = modeCell || category;
          const mission = cells[3].textContent.trim();
          const netSL = parseInt(cells[4].textContent.replace(/,/g, '')) || 0;
          const totalRP = parseInt(cells[5].textContent.replace(/,/g, '')) || 0;
          const targetText = cells[6] ? cells[6].textContent.trim() : '';
          const researched = [];
          if (targetText) {
            targetText.split(/,\s+(?=[^()]+\(\+)/).forEach(part => {
              const mm = part.trim().match(/^(.*)\s\(\+([\d,]+)\)$/);
              if (mm) researched.push({ name: mm[1].trim(), rp: parseInt(mm[2].replace(/,/g, '')) });
            });
          }
          addMatch({ result, mode, category, mission, sessionId, netSL, totalRP, researched, timeSec });
        });
      } catch (err) {
        importNote.textContent = 'Could not read that file as a valid report or data export.';
        return;
      }
    }

    importNote.textContent = `Imported ${added} match(es)` + (skipped ? ` — ${skipped} already loaded, skipped.` : '.') + ' Click Analyze to include them.';
    e.target.value = '';
  };
  reader.readAsText(file);
});

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

/* ---------- Export ---------- */
document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

let minimalExport = false;
document.getElementById('minimalToggle').addEventListener('click', (e) => {
  minimalExport = !minimalExport;
  e.target.classList.toggle('active', minimalExport);
  document.getElementById('exportBtn').textContent = minimalExport ? 'Export Data (minimal)' : 'Export HTML';
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!lastMatches) { alert('Run Analyze first.'); return; }

  if (minimalExport) {
    // Compact, short-key JSON — no styling, no boilerplate, minimum tokens for pasting/re-uploading.
    const data = lastMatches.matches.map(m => ({
      id: m.sessionId,
      r: m.result === 'Victory' ? 'W' : 'L',
      c: m.category,
      m: m.mission,
      sl: m.netSL,
      rp: m.totalRP,
      t: m.timeSec || 0,
      tg: m.researched.map(x => ({ n: x.name, v: x.rp }))
    }));
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wt-session-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const now = new Date().toLocaleString();
  const themesJson = JSON.stringify(THEMES);

  // Export only the deduped match list — duplicates are fully omitted, not just struck through.
  const exportMatchRows = lastMatches.matches.map(m => {
    const target = m.researched.map(r => `${r.name} (+${r.rp.toLocaleString()})`).join(', ');
    const resultClass = m.result === 'Victory' ? 'win' : 'loss';
    return `<tr class="${resultClass}" data-session="${m.sessionId}" data-time="${m.timeSec || 0}">
      <td class="result">${m.result}</td>
      <td>${m.category}</td>
      <td>${m.mode !== m.category ? m.mode : ''}</td>
      <td>${m.mission}</td>
      <td class="num">${m.netSL.toLocaleString()}</td>
      <td class="num">${m.totalRP.toLocaleString()}</td>
      <td>${target}</td>
    </tr>`;
  }).join('');
  const exportMatchTable = `
    <tr><th>Result</th><th>Category</th><th>Sub-mode</th><th>Mission</th>
        <th class="num">Net SL</th><th class="num">RP</th><th>Target(s)</th></tr>
    ${exportMatchRows}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>WT Session Report — ${now}</title>
<style>
  :root {
    --bg: ${THEMES[currentTheme].bg}; --panel: ${THEMES[currentTheme].panel}; --panel-2: ${THEMES[currentTheme].panel2};
    --border: ${THEMES[currentTheme].border}; --accent: ${THEMES[currentTheme].accent};
    --text: ${THEMES[currentTheme].text}; --dim: ${THEMES[currentTheme].dim};
    --win: #7fbf6a; --loss: #d16158;
  }
  * { box-sizing: border-box; }
  body { font-family: 'SF Mono', Consolas, Menlo, monospace; background:var(--bg); color:var(--text); padding:30px 16px 60px; margin:0; transition: background 0.15s, color 0.15s; }
  .wrap { max-width:900px; margin:0 auto; }
  .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  h1 { font-size: 20px; margin: 0 0 2px 0; }
  .meta { color:var(--dim); font-size:12px; margin-bottom:24px; }
  .theme-picker { display:flex; gap:6px; align-items:center; padding-top:2px; }
  .theme-picker label { font-size:11px; color:var(--dim); margin-right:4px; }
  .swatch { width:20px; height:20px; border:1px solid var(--border); cursor:pointer; padding:0; }
  .swatch.active { outline:2px solid var(--text); outline-offset:2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing:0.04em; color:var(--accent); border-bottom:1px solid var(--border); padding-bottom:6px; margin-top:28px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; margin-top:8px; }
  th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--border); }
  th { color:var(--dim); font-weight:400; font-size:11px; }
  td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; }
  tr.win td.result { color:var(--win); }
  tr.loss td.result { color:var(--loss); }
  .stat-row { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--border); border:1px solid var(--border); margin-top:8px; }
  .stat-cell { background:var(--panel); padding:12px 10px; }
  .stat-cell .num { font-size:18px; font-weight:700; color:var(--accent); }
  .stat-cell .lbl { font-size:10.5px; color:var(--dim); }
  @media print {
    body { background:#fff !important; color:#111 !important; }
    .theme-picker { display:none !important; }
    .stat-cell, table, th, td { background:#fff !important; border-color:#ccc !important; }
    .stat-cell .num, h1, h2 { color:#111 !important; }
    .meta, th, .dim, .stat-cell .lbl { color:#555 !important; }
    tr.win td.result { color:#2a7a2a !important; }
    tr.loss td.result { color:#a12f2f !important; }
  }
</style></head>
<body>
<div class="wrap">
  <div class="topbar">
    <div>
      <h1>War Thunder Session Report</h1>
      <div class="meta">Generated ${now}</div>
    </div>
    <div class="theme-picker" id="themePicker"><label>Theme</label></div>
  </div>
  <h2>Overall</h2>
  <div class="stat-row">${document.getElementById('overallStats').innerHTML}</div>
  <h2>Battle Type Split</h2>
  <table>${document.getElementById('splitTable').innerHTML}</table>
  <h2>RP by Research Target</h2>
  <table>${document.getElementById('targetTable').innerHTML}</table>
  <h2>Per-Match Detail</h2>
  <table>${exportMatchTable}</table>
</div>
<script>
  const THEMES = ${themesJson};
  let currentTheme = '${currentTheme}';
  function applyTheme(name) {
    const t = THEMES[name]; if (!t) return;
    const root = document.documentElement.style;
    root.setProperty('--bg', t.bg); root.setProperty('--panel', t.panel);
    root.setProperty('--panel-2', t.panel2); root.setProperty('--border', t.border);
    root.setProperty('--accent', t.accent); root.setProperty('--text', t.text); root.setProperty('--dim', t.dim);
    currentTheme = name;
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === name));
  }
  const picker = document.getElementById('themePicker');
  Object.entries(THEMES).forEach(([name, t]) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (name === currentTheme ? ' active' : '');
    btn.style.background = t.accent;
    btn.dataset.theme = name;
    btn.title = name;
    btn.addEventListener('click', () => applyTheme(name));
    picker.appendChild(btn);
  });
<\/script>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wt-session-report.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
