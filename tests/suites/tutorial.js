/* Tutorial suite: the main tours (both views) and the opt-in colour tour, on desktop and phone. */
const { newPage } = require('../harness');

const DESKTOP = { width: 1100, height: 800 }, PHONE = { width: 390, height: 780 };

// Clicks a control in the top bar. On a phone those live behind the Menu button, so open it first if it is closed.
async function tap(p, sel) {
  if (!(await p.isVisible('#themePicker')) && (await p.isVisible('#menuBtn'))) await p.click('#menuBtn');
  await p.click(sel);
}

// Steps through a whole tour with the keyboard, checking every card stays on screen and clear of its spotlight.
async function walk(t, p, key, label) {
  const n = await p.evaluate(k => TUTORIAL_STEPS[k].length, key);
  let shown = 0, spotlit = 0;
  for (let i = 0; i < n; i++) {
    await p.waitForSelector('.tut-card');
    await p.waitForTimeout(260); // the spotlight slides into place
    const info = await p.evaluate(() => {
      const c = document.querySelector('.tut-card').getBoundingClientRect(), s = document.querySelector('.tut-spot');
      const inView = c.left >= -1 && c.top >= -1 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1;
      let spot = null; if (s.style.display !== 'none') { const r = s.getBoundingClientRect(); spot = { t: r.top, b: r.bottom, h: r.height }; }
      return { title: document.getElementById('tutTitle').textContent, step: document.getElementById('tutStep').textContent, inView, spot, ct: c.top, cb: c.bottom };
    });
    shown++;
    t.check(`${label} ${info.step}: "${info.title}" stays inside the screen`, info.inView);
    if (info.spot) { spotlit++; const overlap = !(info.cb < info.spot.t || info.ct > info.spot.b); t.check(`${label} ${info.step}: the card doesn't cover what it points at`, !overlap || info.spot.h > 500); }
    if (i < n - 1) await p.keyboard.press('ArrowRight'); else await p.click('#tutNext');
  }
  return { n, shown, spotlit };
}

exports.run = async ({ browser, base, t }) => {
  for (const [vpName, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
    t.scope(`tutorial › ${vpName}`);
    // ---- Basic: opens by itself the first time only
    let p = await newPage(browser, { tutorialSeen: false, viewport });
    await p.goto(base + 'wt-log-analyzer.html');
    await p.waitForSelector('.tut-card', { timeout: 3000 });
    t.check(`${vpName}: the Basic tour opens by itself on the first visit`, true);
    const b = await walk(t, p, 'basic', `${vpName} basic`);
    t.check(`${vpName}: the Basic tour has a Colours step`, await p.evaluate(() => TUTORIAL_STEPS.basic.some(s => s.title.includes('Colours'))));
    t.check(`${vpName}: the Basic tour closes after "Done"`, !(await p.$('.tut-card')));
    await p.reload(); await p.waitForTimeout(900);
    t.check(`${vpName}: …and does not open again by itself`, !(await p.$('.tut-card')));
    await tap(p, '#tutorialBtn'); await p.waitForSelector('.tut-card');
    await p.keyboard.press('Escape'); t.check(`${vpName}: Esc closes it`, !(await p.$('.tut-card')));
    await tap(p, '#tutorialBtn'); await p.waitForSelector('.tut-card'); await p.mouse.click(4, 4);
    t.check(`${vpName}: clicking outside closes it`, !(await p.$('.tut-card')));
    await tap(p, '#tutorialBtn'); await p.waitForSelector('.tut-card');
    for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
    t.check(`${vpName}: Tab stays inside the dialog`, await p.evaluate(() => document.querySelector('.tut-card').contains(document.activeElement)));
    await p.keyboard.press('Escape');
    t.check(`${vpName}: no uncaught errors in the Basic tour`, p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();

    // ---- Advanced
    p = await newPage(browser, { tutorialSeen: false, viewport });
    await p.goto(base + 'advanced.html');
    await p.waitForSelector('.tut-card', { timeout: 3000 });
    await walk(t, p, 'advanced', `${vpName} advanced`);
    t.check(`${vpName}: the Advanced tour has a Colours step`, await p.evaluate(() => TUTORIAL_STEPS.advanced.some(s => s.title.includes('Colours'))));
    await p.goto(base + 'advanced.html'); await p.waitForTimeout(900);
    t.check(`${vpName}: the Advanced tour doesn't reopen by itself`, !(await p.$('.tut-card')));
    await p.ctx.close();

    // ---- the colour tour: opt-in only
    p = await newPage(browser, { viewport });
    await p.goto(base + 'wt-log-analyzer.html');
    await tap(p, '#colourBtn'); await p.waitForSelector('#colourPanel:not([hidden])'); await p.waitForTimeout(900);
    t.check(`${vpName}: opening the colour panel never starts a tour by itself`, !(await p.$('.tut-card')));
    await p.click('#cpHelp'); await p.waitForSelector('.tut-card');
    const texts = await p.evaluate(() => TUTORIAL_STEPS.colours.map(s => s.text).join(' '));
    const rolesMentioned = await p.evaluate(() => COLOUR_ROLES.every(r => TUTORIAL_STEPS.colours.some(s => s.text.includes(r.label + ':') && s.text.includes(r.about))));
    t.check(`${vpName}: the colour tour explains what every one of the nine colours changes`, rolesMentioned);
    t.check(`${vpName}: …and explains the readability rule (3:1 and 4.5:1)`, /3:1/.test(texts) && /4\.5:1/.test(texts));
    t.check(`${vpName}: …and the name, limit and export rules`, /20 presets/.test(texts) && /100/.test(texts) && /Export/.test(texts) && /Spanish/.test(texts));
    const c = await walk(t, p, 'colours', `${vpName} colours`);
    t.check(`${vpName}: every colour-tour step that points at something really points at it (no missing targets)`, c.spotlit === c.n - 2, `${c.spotlit} spotlit of ${c.n} (2 are centred intro/outro)`);
    t.check(`${vpName}: the colour tour ends and the panel is still open`, !(await p.$('.tut-card')) && await p.isVisible('#colourPanel'));
    await p.click('#cpHelp'); await p.waitForSelector('.tut-card');
    await p.keyboard.press('Escape');
    t.check(`${vpName}: first Esc closes only the tour`, !(await p.$('.tut-card')) && await p.isVisible('#colourPanel'));
    await p.focus('#cpPreset'); await p.keyboard.press('Escape');
    t.check(`${vpName}: the next Esc closes the panel`, !(await p.isVisible('#colourPanel')));
    t.check(`${vpName}: no uncaught errors in the colour tour`, p.errs.length === 0, p.errs.join(' | '));
    await p.ctx.close();
  }
};
