/* Guard suite: what a visitor sees when loading is slow, a file doesn't arrive, or the page can't start.
 * (load-guard.js: a calm "still loading" note, and a visible message + Reload button instead of a dead page.) */
const fs = require('fs'), path = require('path');
const { newPage, ROOT } = require('../harness');

// The script each page needs in order to work, as a URL pattern (the trailing * is the ?v=hash on the bundle URL).
const PAGES = [
  { name: 'Basic', url: 'wt-log-analyzer.html', core: '**/dist/app-basic.js*', coreFallback: '**/javascript/main.js', button: '#analyzeBtn' },
  { name: 'Advanced', url: 'advanced.html', core: '**/dist/app-advanced.js*', coreFallback: '**/javascript/advanced.js', button: '#basicLink' }
];

// Records every time a load note appears or disappears, from before the page's own scripts run.
const watch = () => {
  window.__notes = [];
  new MutationObserver(muts => muts.forEach(m => {
    m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('load-note')) window.__notes.push({ added: true, role: n.getAttribute('role'), text: n.textContent, hasReload: !!n.querySelector('button'), at: Math.round(performance.now()) }); });
    m.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList && n.classList.contains('load-note')) window.__notes.push({ removed: true, at: Math.round(performance.now()) }); });
  })).observe(document, { childList: true, subtree: true });
};

async function open(browser, base, page, handler, pattern) {
  const p = await newPage(browser, { init: { fn: watch } });
  // whichever of the page's script names exists is the one to interfere with
  const pat = fs.existsSync(path.join(ROOT, 'dist')) ? page.core : page.coreFallback;
  if (handler) await p.route(pattern || pat, handler);
  return p;
}
const notes = p => p.evaluate(() => window.__notes);

exports.run = async ({ browser, base, t }) => {
  /* ---- the guard file itself ---- */
  t.scope('guard › the file');
  const src = fs.readFileSync(path.join(ROOT, 'javascript', 'load-guard.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const modern = [[/=>/, 'arrow functions'], [/\bconst\b|\blet\b/, 'const/let'], [/`/, 'template strings'], [/\.\.\./, 'spread'], [/\basync\b|\bawait\b/, 'async/await'], [/\bclass\b/, 'classes']].filter(([re]) => re.test(src)).map(([, n]) => n);
  t.check('it is plain ES5, so it still parses on a browser too old to run the rest', modern.length === 0, 'uses ' + modern.join(', '));
  t.check('it is tiny (under 4 KB), because it blocks the first paint', fs.statSync(path.join(ROOT, 'javascript', 'load-guard.js')).size < 4096);

  for (const page of PAGES) {
    t.scope(`guard › ${page.name}`);
    // a normal, fast load shows nothing at all
    let p = await open(browser, base, page);
    await p.goto(base + page.url); await p.waitForTimeout(500);
    t.check('a normal load never shows a note (nothing flickers up)', (await notes(p)).length === 0, JSON.stringify(await notes(p)));
    t.check('the page reports itself ready', await p.evaluate(() => window.__wtReady === true));
    await p.ctx.close();

    // slow: the core script takes 6 s
    p = await open(browser, base, page, async r => { await new Promise(res => setTimeout(res, 6000)); try { await r.continue(); } catch (e) { /* page closed */ } });
    const go = p.goto(base + page.url, { waitUntil: 'commit' }).catch(() => {});
    await p.waitForTimeout(4800);
    const slow = (await notes(p)).filter(n => n.added);
    t.check('after a few seconds of waiting, a calm "still loading" note appears (role=status)', slow.length === 1 && slow[0].role === 'status' && /Still loading/.test(slow[0].text) && !slow[0].hasReload, JSON.stringify(slow));
    t.check('…and it does not appear before about 3.5 s (no nagging on a merely slow-ish load)', slow.length === 1 && slow[0].at >= 3300, slow[0] && slow[0].at + ' ms');
    await go; await p.waitForFunction(() => window.__wtReady === true, null, { timeout: 15000 });
    t.check('once the page is ready the note goes away by itself', (await notes(p)).some(n => n.removed) && !(await p.$('.load-note')));
    await p.ctx.close();

    // a file that never arrives
    p = await open(browser, base, page, r => r.abort());
    await p.goto(base + page.url); await p.waitForTimeout(900);
    const lost = (await notes(p)).filter(n => n.added);
    t.check('a script that fails to arrive gives a visible alert with a Reload button', lost.length >= 1 && lost[lost.length - 1].role === 'alert' && lost[lost.length - 1].hasReload, JSON.stringify(lost));
    t.check('…saying what happened in plain words', /didn.t load|couldn.t start/.test(lost.map(n => n.text).join(' ')));
    const nav = p.waitForEvent('framenavigated', { timeout: 4000 }).then(() => true).catch(() => false);
    await p.click('.load-note button');
    t.check('the Reload button reloads the page', await nav);
    await p.ctx.close();

    // a script that arrives but cannot run (what a browser too old for the syntax would hit)
    p = await open(browser, base, page, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'this is not valid javascript (((' }));
    await p.goto(base + page.url); await p.waitForTimeout(900);
    const broken = (await notes(p)).filter(n => n.added);
    t.check('a script that cannot run is reported too, after the page has finished loading', broken.length >= 1 && broken[broken.length - 1].role === 'alert' && /couldn.t start/.test(broken[broken.length - 1].text), JSON.stringify(broken));
    await p.ctx.close();

    // the stylesheet fails: the message must still be readable
    p = await open(browser, base, page, r => r.abort(), '**/css/styles.css');
    await p.goto(base + page.url); await p.waitForTimeout(700);
    const css = await p.evaluate(() => { const n = document.querySelector('.load-note'); if (!n) return null; const s = getComputedStyle(n); return { color: s.color, bg: s.backgroundColor, pos: s.position }; });
    t.check('when the stylesheet is what failed, the alert is still shown and readable (inline styling)', css && css.pos === 'fixed' && css.color !== css.bg, JSON.stringify(css));
    await p.ctx.close();
  }
};
