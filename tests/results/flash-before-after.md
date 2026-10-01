# Theme flash on load — before / after

Test: `tests/suites/flash.js`. A saved look must be in place when the page body first appears and on every painted frame, with the late `themes.js` deliberately delayed 700 ms (like a phone or slow connection). Covers Basic, Advanced, three kinds of saved look (built-in preset, custom colours + serif + large text on a light theme, old-style `theme` only), nothing saved, and the `index.html` redirect page.

| | checks passing |
|---|---|
| Before the fix (`main` at 8c66ae2) | **17 / 47** |
| After the fix | **47 / 47** |

What the "before" run showed, per painted frame: the default Blue (`#0d1420`) first, then the saved colours, with the in-between colours of the 0.15 s fade visible (e.g. `rgb(13,20,32) → rgb(14,19,30) → rgb(16,18,26) → …`). Text size, font style and the light/dark colour-scheme of native controls were also unset until the late script ran. The redirect page was plain white with black text.

Cause: the stylesheet hard-codes the Blue look, and the only code that applied a saved look ran from scripts at the end of the page. Fix: `javascript/appearance-core.js`, loaded in the `<head>` before the stylesheet, applies the saved look immediately; `themes.js` reuses the same code.

Full regression afterwards: parser, basic, advanced, storage, security, flash, appearance, tutorial and the new invariants suite all pass (appearance + tutorial + invariants: 901/901; the rest: 192/192 incl. the fixed test), no snapshot changed except the exported report, which changed on purpose earlier.
