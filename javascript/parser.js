/* ---------- Parsing ---------- */
// Depends on classify() from categories.js and capLines()/LIMITS from util.js.
// Every pattern here is either anchored to a single (length-capped) line or
// bounded, so input can't make it run away — see tests/suites/parser.js.

// The small summary stored beside each archived match so lists can be built without
// decompressing or re-parsing it. Bump SUMMARY_VERSION whenever parseLog's summary
// fields change meaning — stored summaries with an older version are rebuilt from the raw text.
const SUMMARY_VERSION = 1;
function summaryOf(m) {
  return { pv: SUMMARY_VERSION, result: m.result, mode: m.mode, mission: m.mission, netSL: m.netSL,
    totalRP: m.totalRP, timeSec: m.timeSec, researched: m.researched, researching: m.researching };
}

const RP_NAME_CHAR = /[A-Za-z0-9À-ÿ'".\-() ]/;

// Lines like "Leopard 2K: 5163 RP". The name is the run of allowed characters
// directly before the colon.
function parseRpLines(section) {
  const out = [];
  section.split('\n').forEach(line => {
    const re = /:\s*([\d,]{1,15})\s*RP/g;
    let lastEnd = 0, lm;
    while ((lm = re.exec(line)) !== null) {
      let i = lm.index;
      while (i > lastEnd && RP_NAME_CHAR.test(line[i - 1])) i--;
      const name = line.slice(i, lm.index).trim();
      const rp = parseInt(lm[1].replace(/,/g, ''));
      if (name && rp) out.push({ name, rp });
      lastEnd = re.lastIndex;
    }
  });
  return out;
}

function parseLog(text) {
  text = capLines(text.replace(/\r\n/g, '\n'));
  // [^\S\n] = any whitespace except a newline, so a header never spans lines.
  const headerRegex = /(Victory|Defeat) in the \[([^\]\n]{1,200})\][^\S\n]+(.+?)[^\S\n]+mission!/g;
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

    const sessionMatch = block.match(/Session:\s*([a-f0-9]{1,64})/i);
    const sessionId = sessionMatch ? sessionMatch[1] : ('noid-' + i);

    const timeMatch = block.match(/Time Played\s+(\d{1,6}):(\d{1,2})/);
    const timeSec = timeMatch ? (parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])) : 0;

    // The trailing ", N RP" figure is optional: the game leaves it off when there was no research progress.
    const totalRegex = /Total:\s*([\d,]{1,15})\s*SL,\s*([\d,]{1,15})\s*CRP(?:,\s*([\d,]{1,15})\s*RP)?/g;
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
      return parseRpLines(after.slice(0, stop));
    }
    const researched = extractTargets('Researched unit:', ['Researching progress:', 'Used items:', 'Session:']);
    const researching = extractTargets('Researching progress:', ['Used items:', 'Session:']);

    // The raw block is the source of truth for the detail view and the archive.
    // Trim anything after the Total: line so stray pasted text isn't archived.
    // A block over MAX_BLOCK isn't a real match: it is still analysed, but not kept.
    let rawEnd = block.length;
    if (lastTotal) {
      const nl = block.indexOf('\n', lastTotal.index);
      rawEnd = nl === -1 ? block.length : nl;
    }
    const rawText = block.slice(0, rawEnd).replace(/\s+$/, '');
    const raw = rawText.length <= LIMITS.MAX_BLOCK ? rawText : '';

    const modeBase = headers[i].modeRaw.replace(/\s*#\d+$/, '').trim();
    const category = classify(modeBase);

    matches.push({
      result: headers[i].result, mode: modeBase, category,
      mission: headers[i].mission, sessionId, netSL, totalRP, researched, researching, timeSec, raw
    });
  }
  return matches;
}
