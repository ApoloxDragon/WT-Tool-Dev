/* Build suite (no browser): the committed bundles match their sources, the pages load what they should,
 * nothing is orphaned or duplicated, and the size budgets hold. See tools/build.js. */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), crypto = require('crypto');
const { ROOT } = require('../harness');
const { build, BUNDLES, PAGES } = require('../../tools/build');

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const gz = s => zlib.gzipSync(Buffer.from(s)).length;
const UNBUNDLED = ['load-guard', 'appearance-core', 'archive-worker', 'dev-mode']; // deliberately separate files
const CORE = { 'wt-log-analyzer.html': 'app-basic.js', 'advanced.html': 'app-advanced.js' };

exports.run = async ({ t, distStale = [] }) => {
  t.scope('build › freshness');
  t.check('the committed dist/ bundles and the HTML hashes match a fresh build of the sources (run `node tools/build.js` and commit the result)', distStale.length === 0, 'stale: ' + distStale.join(', '));
  const fresh = build({ write: false });
  t.check('a rebuild right now changes nothing', fresh.stale.length === 0, fresh.stale.join(', '));

  t.scope('build › what the pages load');
  for (const page of PAGES) {
    const html = read(page);
    const head = html.slice(0, html.indexOf('</head>'));
    const scripts = [...html.matchAll(/<script src="([^"]+)"([^>]*)><\/script>/g)].map(m => ({ src: m[1].replace(/\?v=[0-9a-f]+$/, ''), attrs: m[2].trim(), raw: m[1] }));
    t.check(`${page}: loads exactly load-guard, appearance-core, the core bundle and the deferred extras — four scripts`, JSON.stringify(scripts.map(s => s.src)) === JSON.stringify(['javascript/load-guard.js', 'javascript/appearance-core.js', 'dist/' + CORE[page], 'dist/extras.js']), scripts.map(s => s.src).join(', '));
    t.check(`${page}: the two small look/guard scripts come before the stylesheet, so they run before the first paint`, head.indexOf('load-guard.js') > -1 && head.indexOf('load-guard.js') < head.indexOf('appearance-core.js') && head.indexOf('appearance-core.js') < head.indexOf('css/styles.css'));
    t.check(`${page}: only the extras are deferred (the core must run in order, right away)`, scripts.every(s => (s.attrs === 'defer') === (s.src === 'dist/extras.js')), JSON.stringify(scripts.map(s => s.attrs)));
    t.check(`${page}: each bundle URL carries the hash of its content (a changed bundle is a new URL)`, scripts.filter(s => s.src.startsWith('dist/')).every(s => s.raw.endsWith('?v=' + crypto.createHash('sha256').update(read(s.src)).digest('hex').slice(0, 8))));
  }

  t.scope('build › the bundles');
  const sources = fs.readdirSync(path.join(ROOT, 'javascript')).map(f => f.replace(/\.js$/, ''));
  const used = new Set([...Object.values(BUNDLES).flat(), ...UNBUNDLED]);
  t.check('every file in javascript/ goes somewhere (no orphan source, nothing listed that does not exist)', sources.every(s => used.has(s)) && [...used].every(s => sources.includes(s)),
    'orphans: ' + sources.filter(s => !used.has(s)).join(', ') + ' / missing: ' + [...used].filter(s => !sources.includes(s)).join(', '));
  const worker = read('javascript/archive-worker.js');
  const imported = (worker.match(/importScripts\(([^)]*)\)/) || [, ''])[1].match(/'([^']+)'/g) || [];
  t.check('the worker only imports files that exist (they are shipped separately from the bundles)', imported.length > 0 && imported.every(f => fs.existsSync(path.join(ROOT, 'javascript', f.replace(/'/g, '')))), imported.join(','));
  for (const [name, list] of Object.entries(BUNDLES)) {
    const text = read('dist/' + name);
    let compiles = true, why = '';
    try { new vm.Script(text, { filename: name }); } catch (e) { compiles = false; why = e.message; }
    t.check(`dist/${name}: compiles as one script (so no two files declare the same top-level const/let/class)`, compiles, why);
    const fnNames = list.flatMap(f => [...read(`javascript/${f}.js`).matchAll(/^(?:async )?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
    const dup = fnNames.filter((n, i) => fnNames.indexOf(n) !== i);
    t.check(`dist/${name}: no function name is declared twice across its files (one would silently replace the other)`, dup.length === 0, dup.join(', '));
    t.check(`dist/${name}: the sources appear in the order listed in tools/build.js`, list.every((f, i) => i === 0 || text.indexOf(`javascript/${f}.js =====`) > text.indexOf(`javascript/${list[i - 1]}.js =====`)));
    if (name.startsWith('app-')) t.check(`dist/${name}: ends by marking the page ready (what load-guard waits for)`, /window\.__wtReady = true;\s*document\.dispatchEvent\(new Event\('wt-ready'\)\);\s*$/.test(text));
  }

  t.scope('build › size budgets (gzip, as GitHub Pages serves it)');
  for (const page of PAGES) {
    const parts = [page, 'css/styles.css', 'javascript/load-guard.js', 'javascript/appearance-core.js', 'dist/' + CORE[page], 'dist/extras.js'];
    const total = parts.reduce((a, f) => a + gz(read(f)), 0);
    t.metric(`${page}: first visit, text files (KB gzip ×1000)`, total / 1024 * 1000 / 1000);
    t.check(`${page}: text needed for a first visit is under 56 KB gzipped`, total < 56 * 1024, (total / 1024).toFixed(1) + ' KB');
    t.check(`${page}: the core bundle is under 32 KB gzipped (it gates being usable)`, gz(read('dist/' + CORE[page])) < 32 * 1024, (gz(read('dist/' + CORE[page])) / 1024).toFixed(1) + ' KB');
  }
  t.check('the deferred extras are under 14 KB gzipped', gz(read('dist/extras.js')) < 14 * 1024);

  /* ---------- documentation ---------- */
  t.scope('build › documentation (docs/)');
  const docs = require('../../tools/build-docs');
  const dir = path.join(ROOT, 'docs'), html = read('docs/index.html');
  t.check('docs/index.html matches a fresh build of the Markdown pages (run `node tools/build-docs.js` and commit it)', html === docs.build());
  const mds = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  t.check('every Markdown page in docs/ is in the docs page, and every listed page exists', mds.every(f => docs.PAGES.some(([n]) => n === f)) && docs.PAGES.every(([n]) => mds.includes(n)), mds.filter(f => !docs.PAGES.some(([n]) => n === f)).join(', '));
  t.check('the docs page has no scripts, no inline handlers and no external resources (it only serves documentation)', !/<script|\son\w+=|<iframe|<img|<link/i.test(html));
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const broken = [...html.matchAll(/href="#([^"]*)"/g)].map(m => m[1]).filter(h => h && !ids.has(h));
  t.check('every link inside the docs page lands somewhere', broken.length === 0, [...new Set(broken)].join(', '));
  const mdLinks = mds.flatMap(f => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/\]\(([\w.-]+\.md)(?:#[^)]*)?\)/g)].map(m => [f, m[1]])).filter(([, to]) => !mds.includes(to));
  t.check('every link between Markdown pages points at a page that exists', mdLinks.length === 0, mdLinks.map(x => x.join(' -> ')).join(', '));
  t.check('the docs mention nothing the app does not have: no leftover "TODO" or "TBD"', !/\bTODO\b|\bTBD\b/.test(mds.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')));
};
