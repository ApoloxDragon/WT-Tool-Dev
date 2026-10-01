/* ---------- Detail parsing ---------- */
// Pure apart from using capLines() from util.js. Turns the raw text block of ONE match into its
// per-section / per-event breakdown. The raw block is the source of truth — the
// detail is always re-derived from it, so improving this parser later improves
// every match already stored, with nothing lost.
//
// Never throws: anything it doesn't recognise is kept in `unparsed` so a log
// format change degrades the detail view instead of breaking the app.

const DETAIL_PARSER_VERSION = 1;

function detailNum(s) {
  return parseInt(String(s).replace(/,/g, ''), 10) || 0;
}

// Digit runs are capped at 15 characters so matching stays linear on any line.
// Matches "2020 + (PA)1010 + (Booster)404 = 3434 SL" or a bare "0 SL". `unit` is
// "SL" or "RP". Returns { value, text } where value is { base, pa, booster, total }.
function extractAmount(text, unit) {
  const N = '(\\d[\\d,]{0,14})';
  const re = new RegExp(
    N + '(?:\\s*\\+\\s*\\(PA\\)\\s*' + N + ')?(?:\\s*\\+\\s*\\(Booster\\)\\s*' + N + ')?\\s*=\\s*' + N + '\\s*' + unit + '\\b' +
    '|' + N + '\\s*' + unit + '\\b');
  const m = re.exec(text);
  if (!m) return { value: null, text };
  const value = m[4] !== undefined
    ? { base: detailNum(m[1]), pa: detailNum(m[2]), booster: detailNum(m[3]), total: detailNum(m[4]) }
    : { base: detailNum(m[5]), pa: 0, booster: 0, total: detailNum(m[5]) };
  return { value, text: text.slice(0, m.index) + '  ' + text.slice(m.index + m[0].length) };
}

function splitCols(text) {
  return text.split(/\s{2,}/).map(s => s.trim()).filter(s => s && s !== '×' && s !== '-');
}

// Section-specific column meaning. Scouting sections list the victim before a
// "UAV" note; capture lines carry a zone percentage instead of weapon/target.
function assignEventCols(sectionName, cols) {
  const ev = {};
  ev.vehicle = cols.shift() || '';
  if (/scout/i.test(sectionName)) {
    ev.target = cols.shift() || '';
    ev.note = cols.join(' · ');
  } else if (/capture/i.test(sectionName)) {
    ev.note = cols.join(' · ');
  } else {
    if (cols.length === 1) { ev.target = cols.shift(); }
    else { ev.weapon = cols.shift() || ''; ev.target = cols.shift() || ''; }
    ev.note = cols.join(' · ');
  }
  return ev;
}

function parseSectionEvent(sectionName, line) {
  let text = line.replace(/^\s+/, '');
  const ev = {};
  const timeM = text.match(/^(\d+:\d+)\s+/);
  if (timeM) { ev.time = timeM[1]; text = text.slice(timeM[0].length); }
  const ptsM = text.match(/(\d[\d,]{0,14})\s+mission points/);
  if (ptsM) { ev.points = detailNum(ptsM[1]); text = text.replace(ptsM[0], '  '); }
  const sl = extractAmount(text, 'SL'); text = sl.text;
  const rp = extractAmount(text, 'RP'); text = rp.text;
  if (sl.value) ev.sl = sl.value;
  if (rp.value) ev.rp = rp.value;
  const cols = splitCols(text);

  if (/^Awards$/i.test(sectionName)) {
    ev.name = cols.join(' ');
  } else if (/^Activity Time$/i.test(sectionName)) {
    ev.vehicle = cols[0] || '';
  } else if (/^Time Played$/i.test(sectionName)) {
    // Columns are "vehicle  [NN%]  m:ss" — the percentage is absent in some logs
    // (e.g. single-vehicle Tank Assault), so identify them by shape, not position.
    ev.vehicle = cols[0] || '';
    cols.slice(1).forEach(c => {
      if (/^\d+%$/.test(c)) ev.activityPct = detailNum(c);
      else if (/^\d+:\d+$/.test(c)) ev.time = c;
    });
  } else if (/^Skill Bonus$/i.test(sectionName)) {
    ev.vehicle = cols[0] || '';
    ev.level = cols[1] || '';
  } else {
    Object.assign(ev, assignEventCols(sectionName, cols));
  }
  return ev;
}

function parseDetail(block) {
  const lines = capLines(String(block || '').replace(/\r\n/g, '\n')).split('\n');
  const detail = {
    version: DETAIL_PARSER_VERSION,
    sections: [], footer: {}, researched: [], researching: [], usedItems: [], unparsed: []
  };
  let section = null;
  let listKey = null;       // 'researched' | 'researching' while inside those lists
  let inUsedItems = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    if (i === 0 && /^(Victory|Defeat) in the /.test(line)) continue;

    const sess = line.match(/^Session:\s*(\S+)/);
    if (sess) { detail.sessionId = sess[1]; inUsedItems = false; listKey = null; section = null; continue; }
    const tot = line.match(/^Total:\s*([\d,]{1,15})\s*SL,\s*([\d,]{1,15})\s*CRP,\s*([\d,]{1,15})\s*RP/);
    if (tot) { detail.total = { sl: detailNum(tot[1]), crp: detailNum(tot[2]), rp: detailNum(tot[3]) }; continue; }

    if (!line) { section = null; listKey = null; continue; }

    if (inUsedItems) { detail.usedItems.push(line); continue; }

    if (/^\s/.test(line)) {
      if (section) section.events.push(parseSectionEvent(section.name, line));
      else detail.unparsed.push(line);
      continue;
    }

    if (/^Used items:/.test(line)) { inUsedItems = true; section = null; continue; }
    if (/^Researched unit:/.test(line)) { listKey = 'researched'; section = null; continue; }
    if (/^Researching progress:/.test(line)) { listKey = 'researching'; section = null; continue; }
    if (listKey) {
      const lm = line.match(/^(.+?):\s*([\d,]{1,15})\s*RP/);
      if (lm) detail[listKey].push({ name: lm[1].trim(), rp: detailNum(lm[2]) });
      else detail.unparsed.push(line);
      continue;
    }

    // Section header: "Name   [count]  [SL]  [RP]" — the name runs to the first gap
    // of two or more spaces (or the end of the line), starts with a capital and
    // holds no colon; the figures after it are optional (e.g. a bare "Activity Time").
    const gap = line.search(/\s{2,}/);
    const headName = gap === -1 ? line : line.slice(0, gap);
    if (/^[A-Z]/.test(headName) && headName.indexOf(':') === -1) {
      const rest = gap === -1 ? '' : line.slice(gap).trim();
      const sec = { name: headName.trim(), events: [] };
      const timeM = rest.match(/(?:^|\s)(\d{1,4}:\d{1,2})(?:\s|$)/);
      if (timeM) sec.time = timeM[1];
      const slM = rest.match(/(-?\d[\d,]{0,14})\s*SL\b/);
      const rpM = rest.match(/(-?\d[\d,]{0,14})\s*RP\b/);
      if (slM) sec.sl = detailNum(slM[1]);
      if (rpM) sec.rp = detailNum(rpM[1]);
      const countM = rest.match(/^(\d{1,9})(?=\s|$)/);
      if (countM) sec.count = parseInt(countM[1], 10);
      detail.sections.push(sec);
      section = sec;
      continue;
    }

    const fm = line.match(/^([^:]+):\s*(.*)$/);
    if (fm) {
      const key = fm[1].trim(), val = fm[2].trim();
      if (key === 'Earned') {
        const e = val.match(/([\d,]{1,15})\s*SL,\s*([\d,]{1,15})\s*CRP/);
        if (e) { detail.footer.earnedSL = detailNum(e[1]); detail.footer.earnedCRP = detailNum(e[2]); }
      } else if (key === 'Activity') {
        detail.footer.activityPct = detailNum(val);
      } else if (key === 'Damaged Vehicles') {
        detail.footer.damagedVehicles = val.split(/,\s*/).filter(Boolean);
      } else if (key === 'Backup vehicles spent') {
        detail.footer.backupVehicles = val.split(/,\s*/).filter(Boolean);
      } else if (key === 'Automatic repair of all vehicles') {
        detail.footer.repairSL = detailNum(val);
      } else if (/^Automatic purchasing/.test(key)) {
        detail.footer.ammoSL = detailNum(val);
      } else if (key === 'Respawns in battle') {
        detail.footer.respawnSL = detailNum(val);
      } else {
        (detail.footer.other = detail.footer.other || Object.create(null))[key] = val;
      }
      continue;
    }
    detail.unparsed.push(line);
  }

  // Vehicle roster: merge the per-vehicle sections so the UI can show one row each.
  const byVehicle = Object.create(null); // names come from the log: no inherited keys like "constructor"
  const vehicleOf = name => byVehicle[name] || (byVehicle[name] = { name });
  detail.sections.forEach(sec => {
    if (/^Time Played$/i.test(sec.name)) {
      sec.events.forEach(ev => { const v = vehicleOf(ev.vehicle); v.activityPct = ev.activityPct; v.time = ev.time; v.rp = ev.rp; });
    } else if (/^Activity Time$/i.test(sec.name)) {
      sec.events.forEach(ev => { const v = vehicleOf(ev.vehicle); v.activitySL = ev.sl; v.activityRP = ev.rp; });
    } else if (/^Skill Bonus$/i.test(sec.name)) {
      sec.events.forEach(ev => { const v = vehicleOf(ev.vehicle); v.skillLevel = ev.level; v.skillRP = ev.rp; });
    }
  });
  detail.vehicles = Object.values(byVehicle);
  return detail;
}
