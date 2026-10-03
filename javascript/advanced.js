/* ---------- Advanced view ---------- */
// Everything here is rebuilt from the raw archive (WtDB): the library is the
// archive re-parsed, the detail panel re-derives events from the raw block.
// Depends on: WtDB (db.js), parseLog/summaryOf/SUMMARY_VERSION (parser.js), classify (categories.js), parseDetail (detail-parser.js),
// computeCategoryStats/formatTime (math.js), raw-export.js helpers, esc (util.js).

let library = [];                 // [{ m: match summary, hasRaw }] — built from stored summaries, no raw text
const detailCache = new Map();    // sessionId -> { raw, detail } (raw text is fetched only when a match is opened)
let detailInsights = null;        // memoised promise of the vehicle / event-type totals
let selectedId = null;
const ROW_CAP = 500;
let showAllRows = false;

const fmt = n => (Number(n) || 0).toLocaleString();
const el = id => document.getElementById(id);
// Session IDs are fixed-width hex that grows with time, so they sort chronologically.
const cmpId = (a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);

// Raw text and parsed detail for one archived match, fetched on demand.
async function getRawAndDetail(entry) {
  if (!entry.hasRaw) return null;
  const id = entry.m.sessionId;
  if (!detailCache.has(id)) {
    const raw = await WtDB.get(id);
    detailCache.set(id, raw == null ? null : { raw, detail: parseDetail(raw) });
  }
  return detailCache.get(id);
}

/* ---------- Library ---------- */
// The list is built from the small summary stored with every archived match, so
// opening this page never decompresses the archive. Matches archived without a
// current summary (older builds, the localStorage fallback) are read and parsed
// once, and the summary is saved for next time.
async function loadLibrary() {
  const metas = await WtDB.meta();
  const byId = new Map();
  const stale = [];
  metas.forEach(meta => {
    const s = meta.sum;
    // category is derived now, so edits to the category rules apply to old matches too
    const m = (s && s.pv === SUMMARY_VERSION && typeof s.mode === 'string') ? sanitizeMatch({ ...s, sessionId: meta.id, category: classify(s.mode) }) : null;
    // `sum` and `ins` are kept so Insights can be built from them (ins is checked; null = to be computed)
    if (m) byId.set(meta.id, { m, hasRaw: true, sum: s, ins: cleanInsights(s.ins) }); else stale.push(meta.id);
  });
  if (stale.length) {
    const blocks = await WtDB.getMany(stale);
    const parsed = blocks.length ? parseLog(blocks.map(b => b.text).join('\n\n')) : [];
    const pairs = [];
    parsed.forEach(pm => {
      const m = sanitizeMatch(pm);
      if (m && !byId.has(m.sessionId)) { const sum = summaryOf(pm); byId.set(m.sessionId, { m, hasRaw: true, sum, ins: null }); pairs.push([m.sessionId, sum]); }
    });
    WtDB.setSummaries(pairs); // saved in the background
  }
  // Summary-only matches from older minimal exports / HTML reports: listed, but no detail.
  loadState('importedMatches', [], sanitizeMatchList).forEach(m => {
    if (m && m.sessionId && !byId.has(m.sessionId)) byId.set(m.sessionId, { m, hasRaw: false });
  });
  library = [...byId.values()];
  detailCache.clear();
  detailInsights = null;
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

async function renderDetail(entry) {
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

  const loaded = await getRawAndDetail(entry);
  if (selectedId !== m.sessionId) return; // another match was opened while this one loaded
  if (!loaded) {
    body.innerHTML = head + '<div class="empty" style="margin-top:12px;">This match\'s stored text could not be read. Delete it from the archive and re-import it.</div>';
    return;
  }
  const { raw, detail: d } = loaded;
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

    <details class="event-sec"><summary>Raw log text</summary><pre class="raw-pre">${esc(raw)}</pre></details>
    <div class="controls">
      <button class="secondary" id="copyRawBtn">Copy raw text</button>
      <button class="secondary" id="exportOneBtn">Export this match (raw)</button>
      <button class="secondary danger" id="deleteOneBtn">Delete from archive</button>
    </div>`;

  el('copyRawBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(raw); el('copyRawBtn').textContent = 'Copied ✓'; }
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

async function selectMatch(id) {
  const entry = library.find(e => e.m.sessionId === id);
  if (!entry) return;
  selectedId = id;
  // Never leave the previous match's panel under the new selection while this one loads.
  el('detailBody').innerHTML = '<div class="note" style="padding:12px 0;">Loading…</div>';
  el('detailSection').style.display = 'block';
  document.querySelectorAll('#libTable tr.pick').forEach(r => r.classList.toggle('selected', r.dataset.id === id));
  el('detailSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  await renderDetail(entry);
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
  const maps = Object.create(null); // keyed by names from the logs: no inherited keys like "constructor"
  all.forEach(m => {
    const r = maps[m.mission] = maps[m.mission] || { n: 0, w: 0, sl: 0, rp: 0 };
    r.n++; if (m.result === 'Victory') r.w++; r.sl += m.netSL; r.rp += m.totalRP;
  });
  const mapRows = Object.entries(maps).sort((a, b) => b[1].n - a[1].n).map(([name, r]) => `<tr>
      <td>${esc(name)}</td><td class="num">${r.n}</td><td class="num">${(r.w / r.n * 100).toFixed(0)}%</td>
      <td class="num">${fmt(Math.round(r.sl / r.n))}</td><td class="num">${fmt(Math.round(r.rp / r.n))}</td></tr>`).join('');
  el('mapTable').innerHTML = `<tr><th>Map</th><th class="num">Matches</th><th class="num">Win%</th><th class="num">Avg SL</th><th class="num">Avg RP</th></tr>${mapRows}`;

  // By vehicle / event type need every match's detail, i.e. reading the whole archive —
  // so that only happens when one of those two sections is opened.
  ['vehicleTable', 'eventTable'].forEach(id => {
    el(id).innerHTML = '<tr><td class="note">Open this section to load it — it reads every stored match.</td></tr>';
  });
  if (detailInsightsWanted()) renderDetailInsights();
}

const detailInsightsWanted = () => ['vehicleTable', 'eventTable'].some(id => el(id).closest('details').open);

// Builds the totals from per-match rollups (see insightsOf in detail-parser.js), in library order.
function aggregateInsights(entries) {
  const vehicles = Object.create(null), events = Object.create(null); // keyed by names from the logs: no inherited keys
  entries.forEach(({ ins }) => {
    ins.veh.forEach(([name, sec, rp, act]) => {
      const t = vehicles[name] = vehicles[name] || { n: 0, sec: 0, rp: 0, act: 0, actN: 0, kills: 0 };
      if (!sec) return; // spawned but never played
      t.n++; t.sec += sec; t.rp += rp;
      if (act >= 0) { t.act += act; t.actN++; }
    });
    ins.kills.forEach(([name, count]) => { if (vehicles[name]) vehicles[name].kills += count; });
    ins.ev.forEach(([name, count, sl, rp]) => {
      const t = events[name] = events[name] || { n: 0, sl: 0, rp: 0 };
      t.n += count; t.sl += sl; t.rp += rp;
    });
  });
  return { vehicles, events };
}

// Matches saved by this version already carry their rollup, so this is just addition. Older ones are
// read once (in the worker), their rollup is saved back, and the next visit is instant too.
async function computeDetailInsights(onProgress) {
  const withDetail = library.filter(e => e.hasRaw);
  const missing = withDetail.filter(e => !e.ins);
  for (let i = 0; i < missing.length; i += 200) {
    if (onProgress) onProgress(i, missing.length);
    const chunk = missing.slice(i, i + 200);
    const rolled = await WtDB.insightsForIds(chunk.map(e => e.m.sessionId));
    chunk.forEach((e, k) => { e.ins = cleanInsights(rolled[k]); });
    WtDB.setSummaries(chunk.filter(e => e.ins).map(e => [e.m.sessionId, { ...(e.sum || summaryOf(e.m)), ins: e.ins }])); // saved in the background
  }
  return aggregateInsights(withDetail.filter(e => e.ins));
}

async function renderDetailInsights() {
  const waiting = text => ['vehicleTable', 'eventTable'].forEach(id => { el(id).innerHTML = `<tr><td class="note">${text}</td></tr>`; });
  waiting('Adding up the matches…');
  if (!detailInsights) detailInsights = computeDetailInsights((done, total) => waiting(`Preparing insights for ${total.toLocaleString()} older matches (one time only)… ${done.toLocaleString()} done`));
  const mine = detailInsights;
  const { vehicles, events } = await mine;
  if (mine !== detailInsights) return; // the library was reloaded meanwhile
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

/* ---------- Duplicate cleanup ---------- */
// The archive has one record per Session ID, so duplicates live only in the saved pasted text and in imported
// summaries it already contains. The first copy of each match stays; nothing else is touched.
// dedupeLogText uses parseLog's own header / Session ID patterns, so what remains is what parseLog would keep.
function dedupeLogText(text) {
  text = capLines(text.replace(/\r\n/g, '\n'));
  const headerRegex = new RegExp(LOG_HEADER.source, 'g');
  const starts = [];
  let m;
  while ((m = headerRegex.exec(text)) !== null) starts.push(m.index);
  if (!starts.length) return { text, removed: 0 };
  const seen = new Set();
  let out = text.slice(0, starts[0]), removed = 0;
  starts.forEach((start, i) => {
    const block = text.slice(start, i + 1 < starts.length ? starts[i + 1] : text.length);
    const sm = block.match(SESSION_ID);
    if (sm && seen.has(sm[1])) { removed++; return; }
    if (sm) seen.add(sm[1]);
    out += block;
  });
  return { text: out, removed };
}

function findDuplicates() {
  const savedText = loadState('inputText', '', v => (typeof v === 'string' ? v : undefined));
  const deduped = dedupeLogText(savedText);
  const inText = new Set(parseLog(deduped.text).map(m => m.sessionId));
  const seen = new Set();
  const imported = loadState('importedMatches', [], sanitizeMatchList);
  const keptImported = imported.filter(m => {
    if (!m.sessionId || m.sessionId.startsWith('noid-')) return true;
    if (inText.has(m.sessionId) || seen.has(m.sessionId)) return false;
    seen.add(m.sessionId);
    return true;
  });
  return { text: deduped.text, textRemoved: deduped.removed, imported: keptImported, importedRemoved: imported.length - keptImported.length };
}

el('dedupeBtn').addEventListener('click', async () => {
  const msg = el('storageMsg');
  const d = findDuplicates();
  const total = d.textRemoved + d.importedRemoved;
  if (!total) { msg.textContent = 'No duplicate matches found in your saved session or imported matches. (The archive keeps one copy per Session ID, so it never holds duplicates.)'; return; }
  const parts = [d.textRemoved ? `${d.textRemoved} from your saved session text` : '', d.importedRemoved ? `${d.importedRemoved} from your imported matches` : ''].filter(Boolean).join(' and ');
  if (!confirm(`Delete ${total} duplicate match(es) — ${parts}? The first copy of each match is kept. This cannot be undone.`)) return;
  if (d.textRemoved) saveState('inputText', d.text);
  if (d.importedRemoved) saveState('importedMatches', d.imported);
  msg.textContent = `Deleted ${total} duplicate match(es): ${parts}. The first copy of each was kept.`;
  await refreshAll();
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

['fCategory', 'fResult', 'fSort', 'fDetailOnly'].forEach(id => {
  el(id).addEventListener('change', () => { showAllRows = false; renderLibrary(); });
});
// Typing re-filters after a short pause instead of on every keystroke.
let searchTimer = null;
el('fSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { showAllRows = false; renderLibrary(); }, 150);
});
['vehicleTable', 'eventTable'].forEach(id => {
  el(id).closest('details').addEventListener('toggle', (e) => { if (e.target.open && library.length) renderDetailInsights(); });
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

// Everything above has run: the page is usable. (load-guard.js watches for this to clear its "still loading" note.)
window.__wtReady = true;
document.dispatchEvent(new Event('wt-ready'));
