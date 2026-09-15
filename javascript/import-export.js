/* ---------- Import ---------- */
// Depends on: importedMatches (main.js).
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

/* ---------- Export ---------- */
// Depends on: lastMatches (main.js), THEMES/currentTheme (themes.js).
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
