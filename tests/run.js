#!/usr/bin/env node
/* Usage:
 *   node tests/run.js --label pre-change                 run everything, save tests/results/pre-change.json
 *   node tests/run.js --label post-change --compare tests/baseline/pre-change.json
 *   options: --only parser,basic,advanced,storage,security,invariants,perf   --scale small|full
 * Needs Playwright (local or global npm install) and Chromium. See tests/README.md. */
const fs = require('fs'), path = require('path');
const { startServer, launch, collector } = require('./harness');
const { build } = require('../tools/build');
const { compare } = require('./compare');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i === -1 ? dflt : args[i + 1]; };
const label = opt('label', 'run');
const only = opt('only', '') ? opt('only').split(',') : null;
const SUITES = ['build', 'parser', 'basic', 'advanced', 'storage', 'security', 'appearance', 'flash', 'guard', 'offline', 'tutorial', 'invariants', 'perf'];
const OPT_IN = ['lowend']; // slow by design: only runs when named with --only

(async () => {
  // The pages load dist/, which is built from javascript/. Never test a stale bundle: rebuild first, but
  // remember what was stale so the build suite can fail (the fix must be committed).
  const distStale = build({ write: false }).stale;
  if (distStale.length) { console.warn('dist/ was out of date — rebuilding for this run: ' + distStale.join(', ')); build({ write: true }); }
  const server = await startServer();
  const browser = await launch();
  const t = collector(label);
  t.out.suites = [];
  const ctx = { browser, base: server.url, t, scale: opt('scale', 'full'), distStale };
  for (const name of [...SUITES, ...OPT_IN]) {
    if (only ? !only.includes(name) : OPT_IN.includes(name)) continue;
    console.log(`\n=== ${name} ===`);
    t.out.suites.push(name);
    t.scope(name);
    try { await require('./suites/' + name).run(ctx); }
    catch (e) { t.check('suite completed without crashing', false, e.stack || e.message); }
  }
  await browser.close(); server.close();

  const outFile = opt('out', path.join(__dirname, 'results', label + '.json'));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(t.out, null, 1));
  const passed = t.out.checks.filter(c => c.pass).length;
  console.log(`\n${passed}/${t.out.checks.length} checks passing, ${Object.keys(t.out.snapshots).length} snapshots, ${Object.keys(t.out.metrics).length} timings → ${path.relative(process.cwd(), outFile)}`);

  const cmp = opt('compare', null);
  if (cmp) {
    const { markdown, regressions } = compare(JSON.parse(fs.readFileSync(cmp, 'utf8')), t.out);
    const md = outFile.replace(/\.json$/, '.comparison.md');
    fs.writeFileSync(md, markdown + '\n');
    console.log('\n' + markdown);
    process.exit(regressions.length ? 1 : 0);
  }
})().catch(e => { console.error(e); process.exit(2); });
