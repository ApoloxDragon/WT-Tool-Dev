/* Menu suite: on a phone the top bar's controls fold behind a Menu button (javascript/nav-menu.js);
 * on a wide screen, and without JavaScript, the top bar is unchanged. */
const { newPage, norm } = require('../harness');

const PHONE = { width: 390, height: 800 }, DESKTOP = { width: 1200, height: 900 };
const PAGES = { basic: 'wt-log-analyzer.html', advanced: 'advanced.html' };

const open = async (browser, base, page, viewport) => {
  const p = await newPage(browser, { viewport });
  await p.goto(base + PAGES[page]);
  await p.waitForSelector('#menuBtn', { state: 'attached' });
  return p;
};
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const menuOpen = p => p.isVisible('#themePicker');
const jumpLabels = p => p.$$eval('.menu-jump-link', bs => bs.map(b => b.textContent.trim()));
// An archive with matches in it, so the Advanced view has something to list.
async function seeded(browser, base, viewport) {
  const p = await newPage(browser, { viewport });
  await p.goto(base + PAGES.basic);
  await p.click('#loadExampleBtn');
  await p.waitForFunction(() => /match/.test(document.getElementById('archiveNote').textContent));
  return p;
}

exports.run = async ({ browser, base, t }) => {
  for (const name of Object.keys(PAGES)) {
    /* ---------- phone, menu closed ---------- */
    t.scope(`menu › phone › ${name}`);
    let p = name === 'advanced' ? await seeded(browser, base, PHONE) : await open(browser, base, name, PHONE);
    if (name === 'advanced') { await p.goto(base + PAGES.advanced); await p.waitForSelector('#libTable tr.pick'); }
    t.check('the Menu button is shown', await p.isVisible('#menuBtn'));
    t.check('the controls are folded away (not on screen, so not reachable by Tab either)', !(await menuOpen(p)) && !(await p.isVisible('.view-link')) && !(await p.isVisible('#tutorialBtn')));
    t.check('the button says it is collapsed, and what it controls', (await p.getAttribute('#menuBtn', 'aria-expanded')) === 'false' && (await p.getAttribute('#menuBtn', 'aria-controls')) === 'themePicker');
    t.check('no sideways scrolling while the menu is closed', (await overflow(p)) <= 0, `${await overflow(p)}px too wide`);

    /* ---------- phone, menu open ---------- */
    await p.click('#menuBtn');
    t.check('tapping Menu opens it and says so', (await menuOpen(p)) && (await p.getAttribute('#menuBtn', 'aria-expanded')) === 'true');
    t.check('no sideways scrolling while the menu is open', (await overflow(p)) <= 0, `${await overflow(p)}px too wide`);
    const vis = sel => p.isVisible(sel);
    t.check('it holds the view switch, Tutorial, GitHub, the colour swatches and Customise',
      await vis('.view-link') && await vis('#tutorialBtn') && await vis('.github-link') && await vis('#colourBtn') && (await p.$$('#themePicker .swatch')).length >= 8);
    t.check('the GitHub link opens a repository in a new tab, safely', await p.$eval('.github-link', a => /^https:\/\/github\.com\/ApoloxDragon\//.test(a.href) && a.target === '_blank' && /noopener/.test(a.rel)));
    const small = await p.$$eval('#themePicker .view-link, #themePicker .tut-btn, #themePicker .github-link, #themePicker #colourBtn, .menu-jump-link, #menuBtn', els => els.filter(e => e.getBoundingClientRect().height < 40).map(e => (e.id || e.className) + ' ' + Math.round(e.getBoundingClientRect().height)));
    const swatchMin = await p.$$eval('#themePicker .swatch', els => Math.min(...els.map(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))));
    t.check('every button and link in the menu is at least 40 px tall and the swatches 32 px', small.length === 0 && swatchMin >= 32, JSON.stringify(small) + ' swatch ' + swatchMin);
    t.check('everything in the open menu stays inside the screen width', await p.$$eval('#themePicker *', els => els.every(e => { const r = e.getBoundingClientRect(); return !r.width || (r.left >= -1 && r.right <= innerWidth + 1); })));

    /* ---------- the "Jump to" list ---------- */
    const labels = await jumpLabels(p);
    if (name === 'basic') {
      t.check('before any analysis, only what is on screen is listed', labels.includes('Paste logs') && !labels.includes('Goal calculator') && !labels.includes('Per-match detail'), labels.join(', '));
      await p.click('#menuBtn');                                  // close
      await p.click('#loadExampleBtn');
      await p.waitForFunction(() => document.querySelectorAll('#matchTable tr').length > 1);
      await p.click('#menuBtn');
      const after = await jumpLabels(p);
      t.check('after Analyze, the result sections appear in the list', ['Overall', 'Goal calculator', 'Research targets', 'Per-match detail'].every(l => after.includes(l)), after.join(', '));
    } else {
      t.check('the list offers Library, Insights and Storage (Match detail only once one is open)', ['Library', 'Insights', 'Storage'].every(l => labels.includes(l)) && !labels.includes('Match detail'), labels.join(', '));
    }
    const target = name === 'basic' ? { label: 'Per-match detail', sel: '#matchTable' } : { label: 'Storage', sel: '#storageSection' };
    await p.click(`.menu-jump-link:text-is("${target.label}")`);
    t.check('choosing a section closes the menu', !(await menuOpen(p)));
    await p.waitForFunction(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0; }, target.sel, { timeout: 8000 }).catch(() => {});
    t.check(`…and scrolls to it (${target.label})`, await p.$eval(target.sel, el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0; }));

    /* ---------- closing it ---------- */
    await p.click('#menuBtn'); await p.keyboard.press('Escape');
    t.check('Escape closes it and puts focus back on the button', !(await menuOpen(p)) && (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'menuBtn');
    // A tap on the page background (dispatched on the wrapper, so it can never land on a real button).
    await p.click('#menuBtn'); await p.evaluate(() => document.querySelector('.wrap').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    t.check('tapping outside closes it', !(await menuOpen(p)));
    await p.click('#menuBtn'); await p.click('#menuBtn');
    t.check('tapping Menu again closes it', !(await menuOpen(p)));

    /* ---------- colours from the menu ---------- */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#menuBtn');
    const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const before = await bg();
    const swatches = () => p.$$('#themePicker .swatch');
    const last = await swatches();
    await last[last.length - 1].click();                       // the last one is a light preset: the page colour changes
    await p.waitForFunction(b => getComputedStyle(document.body).backgroundColor !== b, before, { timeout: 3000 }).catch(() => {});   // the colour fades over 0.15 s
    t.check('picking a swatch changes the colours', (await bg()) !== before, `${before} → ${await bg()}`);
    t.check('…and leaves the menu open', await menuOpen(p));
    await (await swatches())[0].click();
    await p.click('#colourBtn');
    const cp = await p.evaluate(() => ({ open: document.body.classList.contains('cp-open'), panel: !!document.getElementById('colourPanel') && getComputedStyle(document.getElementById('colourPanel')).display }));
    t.check('Customise… opens the colour panel', cp.open, JSON.stringify(cp));
    await p.waitForTimeout(100);
    t.check('…and closes the menu', !(await menuOpen(p)));
    await p.keyboard.press('Escape');

    /* ---------- the view switch ---------- */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.click('#menuBtn');
    await Promise.all([p.waitForNavigation(), p.click('.view-link')]);
    t.check('the view switch in the menu goes to the other view', p.url().endsWith(name === 'basic' ? PAGES.advanced : PAGES.basic), p.url());

    /* ---------- the tutorial and the menu ---------- */
    await p.goto(base + PAGES[name]);
    await p.waitForSelector('#menuBtn', { state: 'attached' });
    if (name === 'advanced') await p.waitForSelector('#libTable tr.pick');
    await p.click('#menuBtn'); await p.click('#tutorialBtn');
    await p.waitForSelector('#tutCard');
    t.check('starting the tutorial from the menu closes the menu', !(await menuOpen(p)));
    let guard = 0;
    while (guard++ < 20 && !/Colours/.test(await p.textContent('#tutTitle'))) await p.click('#tutNext');
    t.check('on the Colours step the tour opens the menu itself, so what it points at is on screen', (await menuOpen(p)) && (await p.isVisible('#colourBtn')) && (await p.isVisible('.tut-spot')));
    const card = await p.$eval('#tutCard', c => { const r = c.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight }; });
    t.check('the tutorial card stays inside the screen on that step', card.l >= 0 && card.r <= card.vw && card.t >= 0 && card.b <= card.vh, JSON.stringify(card));
    t.check('the tutorial card does not cover the Customise button', await p.evaluate(() => { const a = document.getElementById('tutCard').getBoundingClientRect(), b = document.getElementById('colourBtn').getBoundingClientRect(); return a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right; }));
    await p.click('#tutNext');
    // The next step decides: the Advanced tour's "Back to Basic" step points at a link inside the menu, so the menu stays open for it.
    const next = (await p.$('#tutCard')) ? await p.textContent('#tutTitle') : '(tour over)';
    const wantOpen = /Back to Basic/.test(next);
    t.check(`moving on to "${next}" ${wantOpen ? 'keeps the menu open (its target is in the menu)' : 'closes the menu again'}`, (await menuOpen(p)) === wantOpen);
    if (wantOpen) t.check('…and that target is on screen and spotlighted', (await p.isVisible('#basicLink')) && (await p.isVisible('.tut-spot')));
    await p.keyboard.press('Escape');
    t.check('ending the tour leaves the menu closed and works as before', !(await p.$('#tutCard')) && !(await menuOpen(p)));

    /* ---------- crossing to a wide screen ---------- */
    await p.click('#menuBtn');
    await p.setViewportSize(DESKTOP);
    await p.waitForFunction(() => !document.querySelector('.topbar').classList.contains('menu-open'), null, { timeout: 2000 }).catch(() => {});   // the media query reports the change a moment later
    const wide = { btn: await p.isVisible('#menuBtn'), picker: await p.isVisible('#themePicker'), view: await p.isVisible('.view-link'), openClass: await p.evaluate(() => document.querySelector('.topbar').classList.contains('menu-open')) };
    t.check('growing to a wide screen with the menu open restores the normal top bar', !wide.btn && wide.picker && wide.view && !wide.openClass, JSON.stringify(wide));
    t.check('no uncaught errors', p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();

    /* ---------- wide screen: nothing changes ---------- */
    t.scope(`menu › desktop › ${name}`);
    p = await open(browser, base, name, DESKTOP);
    t.check('there is no Menu button, and the controls are in the top bar as before', !(await p.isVisible('#menuBtn')) && (await p.isVisible('.view-link')) && (await p.isVisible('#tutorialBtn')) && (await p.isVisible('.github-link')) && (await p.isVisible('#colourBtn')));
    t.check('the "Jump to" list is not shown', !(await p.isVisible('.menu-jump')));
    t.check('the GitHub link shows only the icon', (await p.$eval('.github-link', a => getComputedStyle(a, '::after').content)) === 'none' || (await p.$eval('.github-link', a => getComputedStyle(a, '::after').content)) === 'normal');
    t.check('no sideways scrolling', (await overflow(p)) <= 0);
    await p.ctx.close();

    /* ---------- no JavaScript: the top bar is as it was ---------- */
    t.scope(`menu › no JavaScript › ${name}`);
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: PHONE });
    const q = await ctx.newPage();
    await q.goto(base + PAGES[name]);
    t.check('no Menu button is added, and the controls stay visible', !(await q.$('#menuBtn')) && (await q.isVisible('#themePicker')) && (await q.isVisible('.view-link')));
    await ctx.close();
  }
};
