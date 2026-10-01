/* ---------- Import ---------- */
// Depends on: importedMatches (main.js), readRawFile/archiveParsedMatches (raw-export.js).
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

// Persist imported matches without their raw text — that lives in the archive
// (IndexedDB), and would blow through localStorage's quota here.
function withoutRaw(m) {
  const { raw, ...rest } = m;
  return rest;
}

// Raw exports (.json / .json.gz) and plain .txt logs: archive the raw blocks, and
// add their summaries to the current session.
async function importRawMatches(parsedMatches, importNote) {
  const { added, skipped, failed } = await archiveParsedMatches(parsedMatches);
  const existingIds = new Set(importedMatches.map(m => m.sessionId));
  let inSession = 0;
  parsedMatches.forEach(m => {
    if (existingIds.has(m.sessionId)) return;
    importedMatches.push(withoutRaw(m));
    existingIds.add(m.sessionId);
    inSession++;
  });
  saveState('importedMatches', importedMatches);
  importNote.textContent = `Imported ${parsedMatches.length} match(es) from raw data: ${added} new to the local archive`
    + (skipped ? `, ${skipped} already archived` : '')
    + (failed ? `, ${failed} could not be stored (archive unavailable or full)` : '')
    + `. ${inSession} added to this session — click Analyze to include them.`;
}

// Summary-only files: the minimal JSON export and the HTML report. Every entry is
// rebuilt through sanitizeMatch(), so malformed or hostile data is dropped (and
// counted) instead of reaching the page — and one bad entry never aborts the rest.
// Returns { added, skipped, invalid }, or null if the text is neither format.
function importSummaryText(text) {
  const existingIds = new Set(importedMatches.map(m => m.sessionId));
  let added = 0, skipped = 0, invalid = 0;
  const addMatch = (candidate) => {
    const match = sanitizeMatch(candidate);
    if (!match) { invalid++; return; }
    if (existingIds.has(match.sessionId)) { skipped++; return; }
    importedMatches.push(match);
    existingIds.add(match.sessionId);
    added++;
  };

  let parsed, isJson = true;
  try { parsed = JSON.parse(text); } catch (err) { isJson = false; }

  if (isJson) {
    // Minimal JSON format (short keys: id, r, c, m, sl, rp, t, tg).
    if (!Array.isArray(parsed)) return null;
    parsed.slice(0, LIMITS.MAX_IMPORT_MATCHES).forEach(entry => {
      if (!entry || typeof entry !== 'object') { invalid++; return; }
      addMatch({
        sessionId: entry.id,
        result: entry.r === 'W' ? 'Victory' : 'Defeat',
        category: entry.c, mode: entry.c, mission: entry.m,
        netSL: entry.sl, totalRP: entry.rp, timeSec: entry.t,
        researched: Array.isArray(entry.tg) ? entry.tg.map(x => (x && typeof x === 'object') ? { name: x.n, rp: x.v } : null) : []
      });
    });
    return { added, skipped, invalid };
  }

  // HTML report exported by this tool. DOMParser builds an inert document (no scripts
  // run, nothing loads); only the cells' plain text is read.
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const rows = doc.querySelectorAll('tr[data-session]');
  if (rows.length === 0) return null;
  Array.prototype.slice.call(rows, 0, LIMITS.MAX_IMPORT_MATCHES).forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) { invalid++; return; }
    const cell = i => (cells[i] ? cells[i].textContent.trim() : '');
    const researched = [];
    const targetText = cell(6).slice(0, 5000);
    if (targetText) {
      targetText.split(/,\s+(?=[^()]+\(\+)/).forEach(part => {
        const mm = part.trim().match(/^(.*)\s\(\+([\d,]{1,15})\)$/);
        if (mm) researched.push({ name: mm[1].trim(), rp: mm[2] });
      });
    }
    addMatch({
      sessionId: row.dataset.session, result: cell(0), category: cell(1), mode: cell(2) || cell(1), mission: cell(3),
      netSL: cell(4), totalRP: cell(5), timeSec: row.dataset.time, researched
    });
  });
  return { added, skipped, invalid };
}

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const importNote = document.getElementById('importNote');
  e.target.value = ''; // so choosing the same file again still fires "change"
  if (!file) return;

  try {
    const rawMatches = await readRawFile(file); // also enforces the file-size / unpacked-size limits
    if (rawMatches) {
      await importRawMatches(rawMatches, importNote);
      return;
    }
    const result = importSummaryText(await file.text());
    if (!result) {
      importNote.textContent = 'No importable match data found — is that a report or data file exported from this tool?';
      return;
    }
    saveState('importedMatches', importedMatches);
    importNote.textContent = `Imported ${result.added} match(es)`
      + (result.skipped ? ` — ${result.skipped} already loaded, skipped` : '')
      + (result.invalid ? ` — ${result.invalid} invalid entr${result.invalid === 1 ? 'y' : 'ies'} ignored` : '')
      + '. Click Analyze to include them.';
  } catch (err) {
    importNote.textContent = 'Could not read that file: ' + err.message;
  }
});

/* ---------- Export ---------- */
// Depends on: lastMatches (main.js), appearance/BUILTIN_PRESETS/presetById/isModified (themes.js), esc/jsonForScript (util.js).

// localTimestampForFilename() and downloadBlob() live in raw-export.js.

document.getElementById('printBtn').addEventListener('click', () => {
  if (!lastMatches) { alert('Run Analyze first.'); return; }
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

  const exportDate = new Date();
  const fileStamp = localTimestampForFilename(exportDate);

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
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `wt-session-data-${fileStamp}.json`);
    return;
  }

  const now = exportDate.toLocaleString();
  // The report is styled with the colours active right now (all nine, already validated as
  // #rrggbb), and its own picker can switch between the eight presets or back to "Your colours".
  const theme = appearance.colours;
  const reportThemes = {};
  const reportNames = {};
  BUILTIN_PRESETS.forEach(p => { reportThemes[p.id] = p.colours; reportNames[p.id] = p.name; });
  const reportStart = (presetById(appearance.presetId) && !isModified()) ? appearance.presetId : 'current';
  if (reportStart === 'current') { reportThemes.current = theme; reportNames.current = 'Your colours'; }
  const themesJson = jsonForScript(reportThemes);
  const namesJson = jsonForScript(reportNames);
  // The report is a standalone file with one inline script (its theme picker). A fresh
  // random nonce per export means only that script can run, whatever the data contains.
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes)).replace(/[^A-Za-z0-9]/g, '');

  // Export only the deduped match list — duplicates are fully omitted, not just struck through.
  const exportMatchRows = lastMatches.matches.map(m => {
    const target = m.researched.map(r => `${esc(r.name)} (+${r.rp.toLocaleString()})`).join(', ');
    const resultClass = m.result === 'Victory' ? 'win' : 'loss';
    return `<tr class="${resultClass}" data-session="${esc(m.sessionId)}" data-time="${Number(m.timeSec) || 0}">
      <td class="result">${esc(m.result)}</td>
      <td>${esc(m.category)}</td>
      <td>${m.mode !== m.category ? esc(m.mode) : ''}</td>
      <td>${esc(m.mission)}</td>
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
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'">
<title>WT Session Report — ${esc(now)}</title>
<style>
  :root {
    --bg: ${theme.bg}; --panel: ${theme.panel}; --panel-2: ${theme.panel2};
    --border: ${theme.border}; --accent: ${theme.accent};
    --text: ${theme.text}; --dim: ${theme.dim};
    --win: ${theme.win}; --loss: ${theme.loss};
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
      <div class="meta">Generated ${esc(now)}</div>
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
<script nonce="${nonce}">
  const THEMES = ${themesJson};
  const NAMES = ${namesJson};
  let currentTheme = ${jsonForScript(reportStart)};
  function applyTheme(name) {
    const t = THEMES[name]; if (!t) return;
    const root = document.documentElement.style;
    root.setProperty('--bg', t.bg); root.setProperty('--panel', t.panel);
    root.setProperty('--panel-2', t.panel2); root.setProperty('--border', t.border);
    root.setProperty('--accent', t.accent); root.setProperty('--text', t.text); root.setProperty('--dim', t.dim);
    root.setProperty('--win', t.win); root.setProperty('--loss', t.loss);
    currentTheme = name;
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === name));
  }
  const picker = document.getElementById('themePicker');
  Object.entries(THEMES).forEach(([name, t]) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (name === currentTheme ? ' active' : '');
    btn.style.background = 'linear-gradient(135deg, ' + t.bg + ' 50%, ' + t.accent + ' 50%)';
    btn.dataset.theme = name;
    btn.title = NAMES[name] || name;
    btn.addEventListener('click', () => applyTheme(name));
    picker.appendChild(btn);
  });
<\/script>
</body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), `wt-session-report-${fileStamp}.html`);
});

// Raw export: the original match text for everything in the local archive.
document.getElementById('rawExportBtn').addEventListener('click', async () => {
  const note = document.getElementById('importNote');
  const count = await downloadRawExport({ gzip: true });
  note.textContent = count
    ? `Exported ${count} archived match(es) as raw data (.json.gz). Import it here or in the Advanced view to restore everything.`
    : 'Nothing to export yet — the local archive is empty. Analyze some matches first.';
});
