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

const gz = v => zlib.gzipSync(Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)));
const rawExportOf = blocks => ({ format: 'wt-raw-export', version: 1, matches: blocks.map((raw, i) => ({ id: 'x' + i, raw })) });

module.exports = { EX, readEx, exampleLog, splitBlocks, syntheticLog, PAYLOADS, PWN, hostileBlock, gz, rawExportOf, REPORT_HTML };
