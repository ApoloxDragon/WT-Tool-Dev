/* Shared test data: real example files, synthetic large logs, hostile payloads. */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { ROOT } = require('./harness');

const EX = name => path.join(ROOT, 'example data', name);
const readEx = name => fs.readFileSync(EX(name), 'utf8');
const exampleLog = () => readEx('matches.txt').replace(/\r\n/g, '\n');
const REPORT_HTML = 'wt-session-report-2026-09-25_17-31-12.html';

// Splits a pasted log into one text block per match.
function splitBlocks(text) {
  return text.split(/(?=^(?:Victory|Defeat) in the \[)/m).filter(b => b.trim());
}

// N matches built from the real example blocks, each with a unique Session ID
// (15 hex chars, increasing like real ones) so nothing dedupes.
function syntheticLog(n) {
  const blocks = splitBlocks(exampleLog());
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = (0x730000000000000 + i * 4099).toString(16).padStart(15, '0').slice(-15);
    out.push(blocks[i % blocks.length].replace(/Session:\s*[a-f0-9]+/, 'Session: ' + id).replace(/\s+$/, '') + '\n');
  }
  return out.join('\n');
}

// Every vector carries a marker that bumps window.__pwn if it ever executes.
const PWN = 'window.__pwn=(window.__pwn||0)+1';
const PAYLOADS = {
  img: `<img src=x onerror="${PWN}">`,
  svg: `<svg/onload=${PWN}>`,
  script: `<script>${PWN}</script>`,
  attr: `"><img src=x onerror=${PWN}>`
};

// Replaces the mission and mode of a real block with hostile text.
function hostileBlock({ mission, mode }) {
  const b = splitBlocks(exampleLog())[0];
  return b.replace(/^(Victory|Defeat) in the \[[^\]]+\]\s+.+?\s+mission!/,
    `$1 in the [${mode || 'Domination'}] ${mission || 'Sweden'} mission!`).replace(/Session:\s*[a-f0-9]+/, 'Session: deadbeef0000001');
}

// Independent oracle for size-agnostic tests: derives the expected figures straight from the
// raw text with its own simple patterns (not the app's parser), so it holds for ANY log.
// Duplicates are matches repeating an earlier Session ID; the first occurrence is the one kept.
function oracle(text) {
  const blocks = text.replace(/\r\n/g, '\n').split(/(?=^(?:Victory|Defeat) in the \[)/m).filter(b => /^(Victory|Defeat) in the \[/.test(b));
  const all = blocks.map((b, i) => {
    const id = (b.match(/^Session:\s*([a-f0-9]+)/im) || [])[1] || 'noid-' + i;
    // the trailing ", N RP" is optional: the game leaves it off when there was no research progress
    const totals = [...b.matchAll(/^Total:\s*([\d,]+)\s*SL,\s*([\d,]+)\s*CRP(?:,\s*[\d,]+\s*RP)?/gm)].pop();
    const num = s => parseInt(String(s).replace(/,/g, ''), 10);
    return { id, result: b.startsWith('Victory') ? 'Victory' : 'Defeat', sl: totals ? num(totals[1]) : 0, rp: totals ? num(totals[2]) : 0,
      events: b.split('\n').filter(l => /^\s+\S/.test(l)).length, raw: b };
  });
  const seen = new Set();
  const unique = all.filter(m => m.id.startsWith('noid-') || (!seen.has(m.id) && seen.add(m.id)));
  const wins = unique.filter(m => m.result === 'Victory').length;
  return { text, all, unique, wins, losses: unique.length - wins, dupes: all.length - unique.length,
    sl: unique.reduce((a, m) => a + m.sl, 0), rp: unique.reduce((a, m) => a + m.rp, 0),
    winRate: unique.length ? (wins / unique.length * 100).toFixed(1) + '%' : '0.0%' };
}

// Real example files that exist (so the suite still runs if one is missing) plus synthetic and
// transformed logs of assorted, deliberately awkward sizes. `ui` marks the ones also driven through the pages.
function datasets(scale) {
  const fs = require('fs');
  const list = [];
  ['matches.txt', 'matches-large.txt'].forEach(f => { if (fs.existsSync(EX(f))) list.push({ name: f, text: readEx(f), ui: true }); });
  const base = splitBlocks(exampleLog());
  list.push({ name: 'one match', text: syntheticLog(1), ui: true });
  list.push({ name: '2 synthetic matches', text: syntheticLog(2) });
  list.push({ name: '37 synthetic matches', text: syntheticLog(37), ui: true });
  list.push({ name: '1,001 synthetic matches', text: syntheticLog(1001), ui: scale !== 'small' });
  list.push({ name: 'one match pasted 50 times', text: Array(50).fill(base[0]).join('\n'), ui: true });
  list.push({ name: 'a log pasted twice (every match duplicated)', text: syntheticLog(25) + '\n' + syntheticLog(25), ui: true });
  list.push({ name: 'blocks in reverse order', text: base.slice().reverse().join('\n'), ui: true });
  list.push({ name: 'CRLF line endings', text: syntheticLog(15).replace(/\n/g, '\r\n') });
  list.push({ name: 'junk before, between and after the matches', text: 'notes\n\n' + base.slice(0, 5).join('\nsome unrelated line\n') + '\n\ntrailing text' });
  return list;
}
const gz = v => zlib.gzipSync(Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)));
const rawExportOf = blocks => ({ format: 'wt-raw-export', version: 1, matches: blocks.map((raw, i) => ({ id: 'x' + i, raw })) });

module.exports = { oracle, datasets, EX, readEx, exampleLog, splitBlocks, syntheticLog, PAYLOADS, PWN, hostileBlock, gz, rawExportOf, REPORT_HTML };
