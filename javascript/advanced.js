/* ---------- Advanced view ---------- */
// Everything here is rebuilt from the raw archive (WtDB): the library is the
// archive re-parsed, the detail panel re-derives events from the raw block.
// Depends on: WtDB (db.js), parseLog (parser.js), parseDetail (detail-parser.js),
// computeCategoryStats/formatTime (math.js), raw-export.js helpers.

let library = [];                 // [{ m: match summary, hasRaw }]
const detailCache = new Map();    // sessionId -> parseDetail() result
let selectedId = null;
const ROW_CAP = 500;
let showAllRows = false;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (Number(n) || 0).toLocaleString();
const el = id => document.getElementById(id);
// Session IDs are fixed-width hex that grows with time, so they sort chronologically.
const cmpId = (a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);

function getDetail(entry) {
  if (!entry.hasRaw) return null;
  const id = entry.m.sessionId;
  if (!detailCache.has(id)) detailCache.set(id, parseDetail(entry.m.raw));
  return detailCache.get(id);
}

/* ---------- Library ---------- */
async function loadLibrary() {
  const blocks = await WtDB.all();
  const parsed = blocks.length ? parseLog(blocks.map(b => b.text).join('\n\n')) : [];
  const byId = new Map();
  parsed.forEach(m => {
    if (!m.sessionId.startsWith('noid-') && !byId.has(m.sessionId)) byId.set(m.sessionId, { m, hasRaw: true });
  });
  // Summary-only matches from older minimal exports / HTML reports: listed, but no detail.
  loadState('importedMatches', []).forEach(m => {
    if (m && m.sessionId && !byId.has(m.sessionId)) {
      byId.set(m.sessionId, { m: Object.assign({ researched: [], researching: [], timeSec: 0 }, m), hasRaw: false });
    }
  });
  library = [...byId.values()];
  detailCache.clear();
}

function filteredLibrary() {
  const q = el('fSearch').value.trim().toLowerCase();
  const cat = el('fCategory').value;
  const res = el('fResult').value;
  const detailOnly = el('fDetailOnly').checked;
  let rows = library.filter(({ m, hasRaw }) => {
    if (cat && m.category !== cat) return false;
    if (res && m.result !== res) return false;
    if (detailOnly && !hasRaw) return false;
    if (q) {
      const hay = [m.mission, m.category, m.mode, ...m.researched.map(r => r.name)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = el('fSort').value;
  const by = {
    new: (a, b) => cmpId(b.m.sessionId, a.m.sessionId),
    old: (a, b) => cmpId(a.m.sessionId, b.m.sessionId),
    sl: (a, b) => b.m.netSL - a.m.netSL,
    rp: (a, b) => b.m.totalRP - a.m.totalRP,
    time: (a, b) => (b.m.timeSec || 0) - (a.m.timeSec || 0)
  }[sort];
  return rows.sort(by);
}

function renderFilters() {
  const cats = [...new Set(library.map(e => e.m.category))].sort();
  const cur = el('fCategory').value;
  el('fCategory').innerHTML = '<option value="">All battle types</option>'
    + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (cats.includes(cur)) el('fCategory').value = cur;
}

function renderLibrary() {
  const rows = filteredLibrary();
  const ms = rows.map(e => e.m);
  const s = computeCategoryStats(ms, () => true);
  el('libStats').innerHTML = [
    ['MATCHES', s.count],
    ['WIN RATE', s.wr.toFixed(1) + '%'],
    ['TOTAL NET SL', fmt(s.sl)],
    ['TOTAL RP', fmt(s.rp)]
  ].map(([lbl, num]) => `<div class="stat-cell"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');

  const withDetail = rows.filter(e => e.hasRaw).length;
  el('matchCountNote').textContent = `— ${rows.length} shown, ${withDetail} with detail`;
  const shown = showAllRows ? rows : rows.slice(0, ROW_CAP);
  const body = shown.map(({ m, hasRaw }) => {
    const target = m.researched.map(r => `${esc(r.name)} (+${fmt(r.rp)})`).join(', ');
    return `<tr class="${m.result === 'Victory' ? 'win' : 'loss'} pick${hasRaw ? '' : ' nodetail'}${m.sessionId === selectedId ? ' selected' : ''}"
        data-id="${esc(m.sessionId)}" tabindex="0">
      <td class="result">${esc(m.result)}</td>
      <td>${esc(m.category)}</td>
      <td>${esc(m.mission)}</td>
      <td class="num">${esc(formatTime(m.timeSec))}</td>
      <td class="num">${fmt(m.netSL)}</td>
      <td class="num">${fmt(m.totalRP)}</td>
      <td>${target}</td>
      <td class="detail-flag" title="${hasRaw ? 'Detail available — click for the breakdown' : 'Summary only — no detail stored'}">${hasRaw ? '●' : '○'}</td>
    </tr>`;
  }).join('');
  el('libTable').innerHTML = `
    <tr><th>Result</th><th>Category</th><th>Mission</th><th class="num">Time</th>
        <th class="num">Net SL</th><th class="num">RP</th><th>Target(s)</th><th title="● has stored detail">Detail</th></tr>
    ${body || '<tr><td colspan="8" class="note">No matches fit these filters.</td></tr>'}`;

  const note = el('libTableNote');
  if (rows.length > shown.length) {
    note.innerHTML = `Showing the first ${shown.length} of ${rows.length}. <a href="#" id="showAllRows">Show all</a>`;
    el('showAllRows').addEventListener('click', (e) => { e.preventDefault(); showAllRows = true; renderLibrary(); });
  } else {
    note.textContent = 'Click any row marked ● to open its detailed breakdown.';
  }
}

/* ---------- Match detail ---------- */
function breakdownTitle(v) {
  if (!v) return '';
  return [`base ${fmt(v.base)}`, v.pa ? `premium ${fmt(v.pa)}` : '', v.booster ? `booster ${fmt(v.booster)}` : ''].filter(Boolean).join(' + ');
}
const amountCell = v => v
  ? `<td class="num" title="${esc(breakdownTitle(v))}">${fmt(v.total)}</td>`
  : '<td class="num dim">—</td>';

// Columns shown per event section: only those at least one event actually has.
const EVENT_COLS = [
  ['time', 'Time', ev => esc(ev.time || '')],
  ['name', 'Award', ev => esc(ev.name || '')],
  ['vehicle', 'Vehicle', ev => esc(ev.vehicle || '')],
  ['weapon', 'Weapon', ev => esc(ev.weapon || '')],
  ['target', 'Target', ev => esc(ev.target || '')],
  ['note', 'Note', ev => esc(ev.note || '')],
  ['points', 'Pts', ev => ev.points ? fmt(ev.points) : '']
];

function renderEventSection(sec) {
  const cols = EVENT_COLS.filter(([key]) => sec.events.some(ev => ev[key]));
  const head = cols.map(([, label]) => `<th${label === 'Pts' ? ' class="num"' : ''}>${label}</th>`).join('')
    + '<th class="num">SL</th><th class="num">RP</th>';
  const rows = sec.events.map(ev => '<tr>'
    + cols.map(([key, , get]) => `<td${key === 'points' ? ' class="num"' : ''}>${get(ev)}</td>`).join('')
    + amountCell(ev.sl) + amountCell(ev.rp) + '</tr>').join('');
  const count = sec.count != null ? sec.count : sec.events.length;
  return `<details class="event-sec">
    <summary>${esc(sec.name)} <span class="dim">— ${count} event(s)${sec.sl != null ? ' · ' + fmt(sec.sl) + ' SL' : ''}${sec.rp != null ? ' · ' + fmt(sec.rp) + ' RP' : ''}</span></summary>
    <div class="scroll-x"><table><tr>${head}</tr>${rows}</table></div>
  </details>`;
}

function renderDetail(entry) {
  const { m } = entry;
  const body = el('detailBody');
  const head = `<div class="detail-head ${m.result === 'Victory' ? 'win' : 'loss'}">
      <span class="result">${esc(m.result)}</span> · ${esc(m.category)}${m.mode !== m.category ? ' · ' + esc(m.mode) : ''} · <strong>${esc(m.mission)}</strong>
      <span class="dim"> · ${esc(formatTime(m.timeSec))} played · session ${esc(m.sessionId)}</span>
    </div>`;

  if (!entry.hasRaw) {
    body.innerHTML = head + `<div class="empty" style="margin-top:12px;">No detail stored for this match — it only exists as a summary
      (from a minimal export or HTML report). Paste its original log in the Basic view, or import a raw export that includes it, to add detail.</div>`;
    return;
  }

  const d = getDetail(entry);
  const f = d.footer;
  const costs = (f.repairSL || 0) + (f.ammoSL || 0) + (f.respawnSL || 0);
  const tile = (num, lbl) => `<div class="stat-cell"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
  const tiles = [
    tile(fmt(m.netSL), 'NET SL'),
    tile(f.earnedSL != null ? fmt(f.earnedSL) : '—', 'EARNED SL'),
    tile(costs ? fmt(costs) : '—', 'REPAIR / AMMO / RESPAWN'),
    tile(fmt(m.totalRP), 'RP (CRP)'),
    tile(f.activityPct != null ? f.activityPct + '%' : '—', 'ACTIVITY')
  ].join('');

  const damaged = new Set(f.damagedVehicles || []);
  const backup = new Set(f.backupVehicles || []);
  const vehicleRows = d.vehicles.map(v => `<tr>
      <td>${esc(v.name)}${damaged.has(v.name) ? ' <span class="tag">damaged</span>' : ''}${backup.has(v.name) ? ' <span class="tag">backup</span>' : ''}</td>
      <td class="num">${esc(v.time || '—')}</td>
      <td class="num">${v.activityPct != null ? v.activityPct + '%' : '—'}</td>
      <td class="num">${v.activitySL ? fmt(v.activitySL.total) : '—'}</td>
      <td class="num">${v.activityRP ? fmt(v.activityRP.total) : '—'}</td>
      <td class="num">${v.rp ? fmt(v.rp.total) : '—'}</td>
      <td class="num">${v.skillRP ? fmt(v.skillRP.total) + (v.skillLevel ? ' (' + esc(v.skillLevel) + ')' : '') : '—'}</td>
    </tr>`).join('');

  // Vehicle-level sections are folded into the vehicle table; flat rewards get their own list.
  const folded = /^(Activity Time|Time Played|Skill Bonus)$/i;
  const eventSecs = d.sections.filter(s => s.events.length && !folded.test(s.name));
  const flat = d.sections.filter(s => !s.events.length && s.sl != null);

  const costLines = [
    ['Automatic repair', f.repairSL], ['Ammo & crew replenishment', f.ammoSL], ['Respawns in battle', f.respawnSL]
  ].filter(([, v]) => v != null);

  const research = [
    ...d.researched.map(r => `<tr><td>${esc(r.name)}</td><td>New vehicle</td><td class="num">${fmt(r.rp)}</td></tr>`),
    ...d.researching.map(r => `<tr><td>${esc(r.name)}</td><td>Module / progress</td><td class="num">${fmt(r.rp)}</td></tr>`)
  ].join('');

  body.innerHTML = head + `
    <div class="stat-row five" style="margin-top:12px;">${tiles}</div>

    <h3 class="sub">Vehicles</h3>
    <div class="scroll-x"><table>
      <tr><th>Vehicle</th><th class="num">Time</th><th class="num">Activity</th><th class="num">Activity SL</th>
          <th class="num">Activity RP</th><th class="num">Play RP</th><th class="num">Skill bonus RP</th></tr>
      ${vehicleRows || '<tr><td colspan="7" class="note">No vehicle data in this log.</td></tr>'}
    </table></div>

    <h3 class="sub">Events</h3>
    ${eventSecs.map(renderEventSection).join('') || '<div class="note">No per-event lines in this log.</div>'}

    <h3 class="sub">Flat rewards &amp; costs</h3>
    <div class="scroll-x"><table>
      ${flat.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${fmt(s.sl)} SL</td></tr>`).join('')}
      ${costLines.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${fmt(v)} SL</td></tr>`).join('')}
      ${(!flat.length && !costLines.length) ? '<tr><td class="note">None recorded.</td></tr>' : ''}
    </table></div>

    ${research ? `<h3 class="sub">Research</h3><div class="scroll-x"><table>
      <tr><th>Target</th><th>Type</th><th class="num">RP</th></tr>${research}</table></div>` : ''}

    ${d.usedItems.length ? `<h3 class="sub">Used items</h3><pre class="raw-pre">${esc(d.usedItems.join('\n'))}</pre>` : ''}

    ${d.unparsed.length ? `<div class="warn" style="display:block;">${d.unparsed.length} line(s) in this log weren't recognised — see the raw text below.</div>` : ''}

    <details class="event-sec"><summary>Raw log text</summary><pre class="raw-pre">${esc(m.raw)}</pre></details>
    <div class="controls">
      <button class="secondary" id="copyRawBtn">Copy raw text</button>
      <button class="secondary" id="exportOneBtn">Export this match (raw)</button>
      <button class="secondary danger" id="deleteOneBtn">Delete from archive</button>
    </div>`;

  el('copyRawBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(m.raw); el('copyRawBtn').textContent = 'Copied ✓'; }
    catch (e) { el('copyRawBtn').textContent = 'Copy failed — select the raw text manually'; }
  });
  el('exportOneBtn').addEventListener('click', () => downloadRawExport({ gzip: false, ids: [m.sessionId] }));
  el('deleteOneBtn').addEventListener('click', async () => {
    if (!confirm('Delete this match from the local archive? This cannot be undone (unless you have a raw export).')) return;
    await WtDB.remove(m.sessionId);
    closeDetail();
    await refreshAll();
  });
}

function selectMatch(id) {
  const entry = library.find(e => e.m.sessionId === id);
  if (!entry) return;
  selectedId = id;
  renderDetail(entry);
  el('detailSection').style.display = 'block';
  document.querySelectorAll('#libTable tr.pick').forEach(r => r.classList.toggle('selected', r.dataset.id === id));
  el('detailSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
  selectedId = null;
  el('detailSection').style.display = 'none';
  document.querySelectorAll('#libTable tr.selected').forEach(r => r.classList.remove('selected'));
}

/* ---------- Insights ---------- */
function renderInsights() {
  const all = library.map(e => e.m);
  const withDetail = library.filter(e => e.hasRaw);
  el('insightScope').textContent = `— ${all.length} matches, ${withDetail.length} with stored detail`;

  // By map (every match, summary data only)
  const maps = {};
  all.forEach(m => {
    const r = maps[m.mission] = maps[m.mission] || { n: 0, w: 0, sl: 0, rp: 0 };
    r.n++; if (m.result === 'Victory') r.w++; r.sl += m.netSL; r.rp += m.totalRP;
  });
  const mapRows = Object.entries(maps).sort((a, b) => b[1].n - a[1].n).map(([name, r]) => `<tr>
      <td>${esc(name)}</td><td class="num">${r.n}</td><td class="num">${(r.w / r.n * 100).toFixed(0)}%</td>
      <td class="num">${fmt(Math.round(r.sl / r.n))}</td><td class="num">${fmt(Math.round(r.rp / r.n))}</td></tr>`).join('');
  el('mapTable').innerHTML = `<tr><th>Map</th><th class="num">Matches</th><th class="num">Win%</th><th class="num">Avg SL</th><th class="num">Avg RP</th></tr>${mapRows}`;

  // By vehicle + by event type (needs stored detail)
  const vehicles = {}, events = {};
  withDetail.forEach(entry => {
    const d = getDetail(entry);
    d.vehicles.forEach(v => {
      const t = vehicles[v.name] = vehicles[v.name] || { n: 0, sec: 0, rp: 0, act: 0, actN: 0, kills: 0 };
      const sec = v.time ? v.time.split(':').reduce((a, x) => a * 60 + (parseInt(x) || 0), 0) : 0;
      if (!sec) return; // spawned but never played
      t.n++; t.sec += sec; t.rp += v.rp ? v.rp.total : 0;
      if (v.activityPct != null) { t.act += v.activityPct; t.actN++; }
    });
    d.sections.forEach(sec => {
      sec.events.forEach(ev => {
        if (/^Destruction of /i.test(sec.name) && ev.vehicle && vehicles[ev.vehicle]) vehicles[ev.vehicle].kills++;
      });
      if (!sec.events.length || /^(Activity Time|Time Played|Skill Bonus)$/i.test(sec.name)) return;
      const t = events[sec.name] = events[sec.name] || { n: 0, sl: 0, rp: 0 };
      sec.events.forEach(ev => { t.n++; t.sl += ev.sl ? ev.sl.total : 0; t.rp += ev.rp ? ev.rp.total : 0; });
    });
  });
  const vehRows = Object.entries(vehicles).filter(([, t]) => t.n).sort((a, b) => b[1].sec - a[1].sec).map(([name, t]) => `<tr>
      <td>${esc(name)}</td><td class="num">${t.n}</td><td class="num">${esc(formatTime(t.sec))}</td>
      <td class="num">${t.actN ? Math.round(t.act / t.actN) + '%' : '—'}</td><td class="num">${fmt(t.rp)}</td><td class="num">${t.kills}</td></tr>`).join('');
  el('vehicleTable').innerHTML = `<tr><th>Vehicle</th><th class="num">Matches</th><th class="num">Time played</th>
      <th class="num">Avg activity</th><th class="num">Play RP</th><th class="num">Kills</th></tr>
    ${vehRows || '<tr><td colspan="6" class="note">No matches with stored detail yet.</td></tr>'}`;

  const evRows = Object.entries(events).sort((a, b) => b[1].sl - a[1].sl).map(([name, t]) => `<tr>
      <td>${esc(name)}</td><td class="num">${fmt(t.n)}</td><td class="num">${fmt(t.sl)}</td><td class="num">${fmt(t.rp)}</td></tr>`).join('');
  el('eventTable').innerHTML = `<tr><th>Event type</th><th class="num">Events</th><th class="num">SL</th><th class="num">RP</th></tr>
    ${evRows || '<tr><td colspan="4" class="note">No matches with stored detail yet.</td></tr>'}`;
}

/* ---------- Storage panel ---------- */
const fmtBytes = b => b == null ? '—' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

async function renderStorage() {
  const st = await WtDB.stats();
  const tile = (num, lbl) => `<div class="stat-cell"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
  const ratio = st.storedBytes ? (st.rawBytes / st.storedBytes).toFixed(1) + '×' : '—';
  el('storageStats').innerHTML = [
    tile(st.count, 'MATCHES ARCHIVED'),
    tile(fmtBytes(st.storedBytes), 'STORED (COMPRESSED)'),
    tile(ratio, 'COMPRESSION'),
    tile(st.quota ? fmtBytes(st.usage) + ' / ' + fmtBytes(st.quota) : '—', 'BROWSER USAGE / QUOTA')
  ].join('');

  const notes = [];
  if (st.backend === 'idb') notes.push('Backend: IndexedDB, gzip-compressed.');
  else if (st.backend === 'ls') notes.push('⚠ IndexedDB is unavailable, so a small localStorage fallback (about 5 MB) is in use.');
  else notes.push('⚠ No browser storage is available (private mode or blocked) — nothing can be saved.');
  try {
    if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) notes.push('Protected from automatic eviction.');
  } catch (e) { /* ignore */ }
  const last = loadState('lastRawExport', null);
  if (last) {
    const pending = Math.max(0, st.count - last.count);
    notes.push(`Last raw export: ${new Date(last.at).toLocaleString()} (${last.count} matches)`
      + (pending ? ` — ${pending} match(es) added since, not yet backed up.` : ' — everything is backed up.'));
  } else if (st.count) {
    notes.push('You haven\'t exported a raw backup yet.');
  }
  el('storageNote').textContent = notes.join(' ');
}

el('exportRawGz').addEventListener('click', () => exportRaw(true));
el('exportRawJson').addEventListener('click', () => exportRaw(false));
async function exportRaw(gzip) {
  const count = await downloadRawExport({ gzip });
  el('storageMsg').textContent = count ? `Exported ${count} match(es).` : 'Nothing to export — the archive is empty.';
  renderStorage();
}

el('importRawBtn').addEventListener('click', () => el('importRawFile').click());
el('importRawFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const msg = el('storageMsg');
  try {
    const matches = await readRawFile(file);
    if (!matches) {
      msg.textContent = 'That file has no raw match data. Summary-only files (minimal export, HTML report) can be imported from the Basic view.';
    } else {
      const { added, skipped, failed } = await archiveParsedMatches(matches);
      msg.textContent = `Imported ${matches.length} match(es): ${added} new, ${skipped} already archived` + (failed ? `, ${failed} could not be stored.` : '.');
      await refreshAll();
    }
  } catch (err) {
    msg.textContent = 'Could not read that file: ' + err.message;
  }
  e.target.value = '';
});

el('deleteArchiveBtn').addEventListener('click', async () => {
  const n = (await WtDB.ids()).length;
  if (!n) { el('storageMsg').textContent = 'The archive is already empty.'; return; }
  if (!confirm(`Delete all ${n} archived matches from this browser? This cannot be undone — export raw data first if you want a backup.`)) return;
  await WtDB.clear();
  saveState('lastRawExport', null);
  closeDetail();
  el('storageMsg').textContent = `Deleted ${n} archived match(es).`;
  await refreshAll();
});

/* ---------- Wiring ---------- */
async function refreshAll() {
  await loadLibrary();
  const empty = library.length === 0;
  el('libEmpty').style.display = empty ? 'block' : 'none';
  el('libMain').style.display = empty ? 'none' : 'block';
  if (!empty) {
    renderFilters();
    renderLibrary();
    renderInsights();
    if (selectedId && !library.some(e => e.m.sessionId === selectedId)) closeDetail();
  }
  await renderStorage();
}

['fSearch', 'fCategory', 'fResult', 'fSort', 'fDetailOnly'].forEach(id => {
  el(id).addEventListener(id === 'fSearch' ? 'input' : 'change', () => { showAllRows = false; renderLibrary(); });
});
el('detailClose').addEventListener('click', closeDetail);
el('libTable').addEventListener('click', (e) => {
  const row = e.target.closest('tr.pick');
  if (row) selectMatch(row.dataset.id);
});
el('libTable').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const row = e.target.closest('tr.pick');
  if (row) selectMatch(row.dataset.id);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selectedId) closeDetail(); });

refreshAll();
