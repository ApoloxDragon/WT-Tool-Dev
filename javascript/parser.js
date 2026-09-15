/* ---------- Parsing ---------- */
// Depends on classify() from categories.js.
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
