/* Compares two result files (baseline vs current) and renders a markdown report. */
const fs = require('fs'), path = require('path');
// Snapshots that are SUPPOSED to change, with the reason — see tests/expected-changes.json.
function loadExpected() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-changes.json'), 'utf8')); } catch (e) { return {}; }
}

function compare(base, cur) {
  // Only compare the suites that were actually run this time.
  if (cur.suites) {
    const keep = n => cur.suites.includes(n.split(' › ')[0]);
    base = { ...base, checks: base.checks.filter(c => keep(c.name)),
      snapshots: Object.fromEntries(Object.entries(base.snapshots).filter(([n]) => keep(n))),
      metrics: Object.fromEntries(Object.entries(base.metrics).filter(([n]) => keep(n))) };
  }
  const expected = loadExpected();
  const lines = [];
  const L = s => lines.push(s);
  const regress = [];
  const byName = arr => Object.fromEntries(arr.map(c => [c.name, c]));
  const bc = byName(base.checks), cc = byName(cur.checks);

  L(`# Test comparison`);
  L(`Baseline: **${base.label}** (commit ${base.commit}, ${base.date})  \nCurrent: **${cur.label}** (commit ${cur.commit}, ${cur.date})\n`);

  const names = [...new Set([...Object.keys(bc), ...Object.keys(cc)])];
  const fixed = [], broke = [], stillFail = [], added = [], removed = [];
  names.forEach(n => {
    const a = bc[n], b = cc[n];
    if (!a) added.push(b); else if (!b) removed.push(a);
    else if (!a.pass && b.pass) fixed.push(b);
    else if (a.pass && !b.pass) broke.push(b);
    else if (!a.pass && !b.pass) stillFail.push(b);
  });
  const pass = arr => arr.filter(c => c.pass).length;
  L(`## Checks`);
  L(`| | baseline | current |\n|---|---|---|\n| passing | ${pass(base.checks)} / ${base.checks.length} | ${pass(cur.checks)} / ${cur.checks.length} |\n`);
  if (fixed.length) { L(`### Fixed (failed before, pass now): ${fixed.length}`); fixed.forEach(c => L(`- ✅ ${c.name}`)); L(''); }
  if (broke.length) { L(`### REGRESSIONS (passed before, fail now): ${broke.length}`); broke.forEach(c => { L(`- ❌ ${c.name} — ${c.detail}`); regress.push('check: ' + c.name); }); L(''); }
  if (stillFail.length) { L(`### Still failing: ${stillFail.length}`); stillFail.forEach(c => L(`- ⚠️ ${c.name} — ${c.detail}`)); L(''); }
  if (added.length) { L(`### New checks: ${added.length} (${pass(added)} passing)`); added.filter(c => !c.pass).forEach(c => L(`- ❌ ${c.name} — ${c.detail}`)); L(''); }
  if (removed.length) { L(`### Checks no longer run: ${removed.length}`); removed.forEach(c => L(`- ${c.name}`)); L(''); }

  L(`## Snapshots (behaviour on the example data)`);
  const sameSnap = [], diffSnap = [], intended = [];
  Object.keys(base.snapshots).forEach(n => {
    const a = base.snapshots[n], b = cur.snapshots[n];
    if (!b) { diffSnap.push(`- ❌ ${n}: missing in current run`); regress.push('snapshot missing: ' + n); return; }
    if (a.hash === b.hash) { sameSnap.push(n); return; }
    let detail = `${a.hash} → ${b.hash}`;
    if (a.items && b.items) {
      const changed = Object.keys({ ...a.items, ...b.items }).filter(k => a.items[k] !== b.items[k]);
      detail += ` — ${changed.length} item(s) differ: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? '…' : ''}`;
    } else if (a.preview !== undefined) detail += ` — "${a.preview}" → "${b.preview}"`;
    if (expected[n]) { intended.push(`- 🔧 ${n}: ${detail}\n  - *intended:* ${expected[n]}`); return; }
    diffSnap.push(`- ❌ ${n}: ${detail}`); regress.push('snapshot: ' + n);
  });
  L(`${sameSnap.length} identical, ${intended.length} changed on purpose, ${diffSnap.length} changed unexpectedly.\n`);
  intended.forEach(s => L(s));
  diffSnap.forEach(s => L(s));
  const newSnaps = Object.keys(cur.snapshots).filter(n => !base.snapshots[n]);
  if (newSnaps.length) L(`\n${newSnaps.length} new snapshot(s) not in the baseline.`);
  L('');

  L(`## Timings`);
  L(`| metric | baseline ms | current ms | change |\n|---|---:|---:|---:|`);
  Object.keys(base.metrics).forEach(n => {
    const a = base.metrics[n], b = cur.metrics[n];
    if (b == null) return;
    const ratio = a > 0 ? b / a : 1;
    const tag = (a >= 20 || b >= 20) ? (ratio > 2 ? ' 🔺 slower' : ratio < 0.5 ? ' 🟢 faster' : '') : '';
    if (ratio > 3 && Math.max(a, b) >= 100) regress.push('perf: ' + n);
    L(`| ${n} | ${a} | ${b} | ${ratio.toFixed(2)}×${tag} |`);
  });
  L('');
  L(regress.length ? `## RESULT: ${regress.length} regression(s)\n${regress.map(r => '- ' + r).join('\n')}` : `## RESULT: no regressions`);
  return { markdown: lines.join('\n'), regressions: regress };
}
module.exports = { compare };
