/* Parser suite: log parsing and per-match detail parsing, on real data and on hostile input. */
const { newPage, withDeadline, norm } = require('../harness');
const { exampleLog, splitBlocks } = require('../fixtures');

exports.run = async ({ browser, base, t }) => {
  const page = await newPage(browser);
  await page.goto(base + 'wt-log-analyzer.html');
  const text = exampleLog();

  /* ---- real data ---- */
  t.scope('parser › real data');
  const parsed = await page.evaluate(src => parseLog(src).map(m => ({ ...m, raw: undefined, rawLen: m.raw ? m.raw.length : 0, rawOk: !!m.raw && /^(Victory|Defeat) in the /.test(m.raw) && /Total:.*RP\s*$/.test(m.raw) && m.raw.includes(m.sessionId) })), text);
  t.check('finds 84 match blocks in the example log', parsed.length === 84, parsed.length);
  t.check('67 unique Session IDs (17 repeats)', new Set(parsed.map(m => m.sessionId)).size === 67);
  t.check('every match keeps its raw block, from header through the Total: line', parsed.every(m => m.rawOk), parsed.filter(m => !m.rawOk).length + ' bad');
  t.check('no match is missing a Session ID or a total', parsed.every(m => !m.sessionId.startsWith('noid-') && m.totalRP >= 0));
  const byId = {}; parsed.forEach((m, i) => { byId[m.sessionId + '#' + i] = { ...m, rawLen: undefined, rawOk: undefined }; });
  t.snapshot('summary of every parsed match (result, mode, mission, SL, RP, targets, time)', Object.values(byId), byId);
  const uniq = [...new Map(parsed.map(m => [m.sessionId, m])).values()];
  t.snapshot('aggregates over unique matches', {
    n: uniq.length, wins: uniq.filter(m => m.result === 'Victory').length,
    sl: uniq.reduce((a, m) => a + m.netSL, 0), rp: uniq.reduce((a, m) => a + m.totalRP, 0),
    timeSec: uniq.reduce((a, m) => a + m.timeSec, 0)
  });

  /* ---- detail parser ---- */
  t.scope('parser › detail');
  const det = await page.evaluate(src => parseLog(src).map(m => {
    const d = parseDetail(m.raw);
    const sums = d.sections.filter(s => /^(Awards|Damage|Critical|Destruction|Assistance|Scouting|Capture|Severe)/.test(s.name))
      .map(s => ({ n: s.name, hdr: s.sl, sum: s.events.reduce((a, e) => a + (e.sl ? e.sl.total : 0), 0), count: s.count, len: s.events.length }));
    return { id: m.sessionId, d, sums, events: d.sections.reduce((a, s) => a + s.events.length, 0) };
  }), text);
  t.check('1195 event lines parsed — one per indented line in the log', det.reduce((a, x) => a + x.events, 0) === 1195, det.reduce((a, x) => a + x.events, 0));
  t.check('no line is left unrecognised in any match', det.every(x => x.d.unparsed.length === 0), det.filter(x => x.d.unparsed.length).length + ' matches');
  t.check('event SL adds up to the section header in every section', det.every(x => x.sums.every(s => s.hdr === undefined || s.hdr === s.sum)));
  t.check('event counts match the section header counts', det.every(x => x.sums.every(s => s.count === undefined || /Awards/.test(s.n) || s.count === s.len)));
  t.check('every match has a Total: line and a session id that agrees with the summary', det.every((x, i) => x.d.total && x.d.sessionId === x.id));
  const dItems = {}; det.forEach((x, i) => { dItems[x.id + '#' + i] = x.d; });
  t.snapshot('full detail of every match', Object.values(dItems), dItems);

  /* ---- robustness: nothing may throw ---- */
  t.scope('parser › robustness');
  const weird = {
    'empty string': '', 'only whitespace': '  \n\t \n', 'plain garbage': 'hello world\nfoo: bar\n',
    'header only (no body, no total)': 'Victory in the [Domination] Sweden mission!',
    'truncated mid-block': splitBlocks(text)[0].slice(0, 400),
    'CRLF line endings': splitBlocks(text)[0].replace(/\n/g, '\r\n'),
    'unicode names': 'Victory in the [Domination] Zürich ÀÉÎ mission!\n\nDamage to the enemy   1   1 SL   1 RP\n    1:00    Ü-1    Ø-2    Å-3     20 mission points    1 SL    1 RP\n\nSession: abc123\nTotal: 1 SL, 2 CRP, 3 RP',
    'two headers, no bodies': 'Victory in the [A] B mission!\nDefeat in the [C] D mission!',
    'binary-ish': '\u0000\u0001\u0002 Victory in the [x] \u0000 mission!'
  };
  for (const [name, input] of Object.entries(weird)) {
    const r = await page.evaluate(src => { try { const ms = parseLog(src); ms.forEach(m => parseDetail(m.raw)); parseDetail(src); return { ok: true, n: ms.length }; } catch (e) { return { ok: false, err: e.message }; } }, input);
    t.check(`does not throw: ${name}`, r.ok, r.err);
  }
  const crlf = await page.evaluate(src => JSON.stringify(parseLog(src).map(m => ({ ...m, raw: undefined }))), text.replace(/\n/g, '\r\n'));
  const lf = await page.evaluate(src => JSON.stringify(parseLog(src).map(m => ({ ...m, raw: undefined }))), text);
  t.check('CRLF and LF logs parse to identical summaries', crlf === lf);
  await page.ctx.close();

  /* ---- pathological input (each in its own throwaway page with a hard deadline) ---- */
  t.scope('parser › pathological input');
  const cases = {
    'one 120 KB line of repeated "Victory in the [" (no closing bracket)': { fn: 'parseLog', gen: "'Victory in the ['.repeat(7500)" },
    '12,000 short lines of "Victory in the [x" (no closing bracket)': { fn: 'parseLog', gen: "Array(12000).fill('Victory in the [x').join('\\n')" },
    '"Researched unit:" followed by a 40 KB line with no colon': { fn: 'parseLog', gen: "'Victory in the [A] B mission!\\nResearched unit:\\n' + 'a'.repeat(40000) + '\\nSession: abc\\nTotal: 1 SL, 1 CRP, 1 RP'" },
    'an event line that is 40,000 digits long': { fn: 'parseDetail', gen: "'Victory in the [A] B mission!\\n\\nDamage to the enemy   1   5 SL\\n    ' + '1'.repeat(40000) + '\\nSession: abc'" },
    'a 200 KB single line of plain text': { fn: 'parseLog', gen: "'a'.repeat(200000)" }
  };
  for (const [name, c] of Object.entries(cases)) {
    const r = await withDeadline(browser, 25000, async p => {
      await p.goto(base + 'wt-log-analyzer.html');
      return p.evaluate(({ gen, fn }) => { const input = eval(gen); const t0 = performance.now(); try { window[fn](input); if (fn === 'parseLog') parseLog(input).forEach(m => parseDetail(m.raw)); } catch (e) { return { ms: performance.now() - t0, err: e.message }; } return { ms: performance.now() - t0 }; }, c);
    });
    const ms = r.ok ? r.result.ms : 25000;
    t.metric('parse time — ' + name, ms);
    t.check(`finishes in under 1 second: ${name}`, r.ok && !r.result.err && ms < 1000, r.ok ? (r.result.err || Math.round(ms) + ' ms') : r.error);
  }
};
