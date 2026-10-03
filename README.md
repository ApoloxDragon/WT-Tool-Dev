# WT Session Readout

## AI disclosure

This project was built with the assistance of Claude (Anthropic). Code changes — including the parsing logic, bug fixes, and this README — were written collaboratively with Claude rather than entirely by hand.

## What it is

A single-page, client-side tool for analyzing pasted War Thunder match-log text. Paste one or more match reports and it will:

- Split matches by battle type (Random Battles, Tank Assault, or custom rules you define)
- Dedupe repeated match reports by Session ID, so pasting overlapping log ranges never double-counts a match
- Tally RP earned toward new vehicles ("RP by Research Target"), with module/modification RP kept in a separate, collapsed "Other RP" table so the two are never mixed together
- Run a goal calculator estimating how many matches you need to hit an RP or SL target, based on your actual win/loss averages
- Import/export session data so you can carry progress across multiple paste sessions
- Save every analyzed match (compressed, in your browser) so the **Advanced view** can show a full per-match breakdown, cross-match insights and storage tools
- Fit a phone: below 680 px wide the top bar's controls fold into a **Menu** button, which also lists the page's sections to jump to
- Walk you through all of it with a built-in step-by-step tutorial (opens on your first visit; reopen any time from **? Tutorial**)

Everything runs locally in the browser — no server, no account, no data leaves your machine (except when you explicitly export a file). The match archive is stored in your browser only (IndexedDB) and is never uploaded.

**Live demo:** https://apoloxdragon.github.io/WarThunder-Tool/

> **Curious about what's coming next?** In-progress changes are tried out in the [WT-Tool-Dev repo](https://github.com/ApoloxDragon/WT-Tool-Dev) first (live preview: https://apoloxdragon.github.io/WT-Tool-Dev/). It's the unstable development version, so expect rough edges — this page is the stable release.

## Usage

Open `wt-log-analyzer.html` in a browser (or use one of the demos above). Keep it in the same folder as `css/`, `javascript/` and `dist/` if running locally — it loads its stylesheet and scripts as relative paths. (Opened straight from disk with `file://`, everything works except loading the example data, the offline cache and background compression (it falls back to the main thread); a local web server avoids all three.)

Paste one or more match reports — from "Victory/Defeat in the [Mode] ... mission!" through the "Session:" and "Total:" lines — into the text box and click **Analyze**. No local data? Click **Load Example Data** to try it with the sample log in `example data/matches.txt` (this only works on a server/hosted page, not when the file is opened directly from disk, since browsers block that fetch over `file://`).

### Where the RP numbers come from

Each match report ends with a line like:

```
Session: 73cba8e001d7c28
Total: 25493 SL, 7388 CRP, 14776 RP
```

The tool uses the **CRP** figure as "Total RP" for the match, not the trailing "RP" figure. That third field is CRP plus whatever "Researching progress" (a module on a *different* vehicle) earned in the same match added together — the same battle performance credited toward two research targets at once, not two separate payouts. Using it as-is would inflate every average and every "expected RP per match" figure in the goal calculator.

### Battle-type categories

By default, anything with "Tank Assault" in its mode name is split into its own category; everything else falls into "Random Battles". Add your own keyword → label rules (e.g. for Arcade or event modes) via the "Battle-type categories" section.

### Import / Export

- **Export HTML** produces a themed, printable standalone report (only unique, deduped matches — no struck-through duplicate rows).
- **Export Data (minimal)** (toggle next to Export) produces a compact JSON file with short keys, meant for re-uploading later to continue a session. It holds summaries only, so it cannot be used for the per-match detail view.
- **Export Raw** saves the *original match text* of everything in your local archive as `.json.gz` (small) — or `.json` from the Advanced view. This is the lossless backup: importing it rebuilds every summary and per-event detail from scratch, so an old export keeps getting richer as the parser improves.
- **Import Report** accepts any of the above, plus plain `.txt` match logs. Raw files are re-parsed and validated on import; anything that isn't a recognisable match is ignored. Already-archived matches are skipped (matched by Session ID).

## Advanced view

Open it with **Advanced view →** in the top bar (`advanced.html`); **← Basic view** takes you back. The two views share the same saved settings and archive.

- **Library** — every archived match, with search, battle-type / win-loss filters, sorting, and totals for the current filter.
- **Match detail** — click a row marked ● to see net and earned SL, repair / ammo / respawn costs, a per-vehicle table, every scoring event (time, vehicle, weapon, target, SL and RP — hover an amount for its base / premium / booster split), flat rewards, research progress, used items and the raw log text. You can copy the raw text, export just that match, or delete it. Rows marked ○ are summary-only (they came from a minimal export or HTML report, which don't contain the original text).
- **Insights** — results by map, time / kills per vehicle, and which event types earn the most SL and RP.
- **Storage** — archive size and compression, browser quota, backup status, raw export / import, **Clear duplicate matches** (removes repeats, same Session ID, from your saved session and imported matches, keeping the first copy), and delete-all.

### Local storage

Each match's raw text is gzip-compressed (native `CompressionStream`, no library) and stored in IndexedDB under its Session ID, together with a small summary. Because of that summary the Advanced view lists your whole library without unpacking a single match; a match is only decompressed when you open it, and the vehicle / event-type insights read the archive only when you open those sections. If IndexedDB is unavailable a small `localStorage` fallback (about 5 MB) is used, and if neither works the tool still runs — it just can't save detail. The **Clear** button only resets the current session; the archive is managed from the Advanced view's storage panel.

The archive exists only in your browser on this device: clearing site data deletes it and it doesn't sync. **Export Raw regularly as your backup.** The dev build uses its own database name, so it can't touch the stable site's data.

## Colours and text

Pick one of **eight colour presets** with the swatches in the top bar — Blue, Amber, Slate, Forest, Crimson, Violet, Teal and the light Daylight — or open **Customise…** for the full panel (available in both views):

- change **any of nine colours**: background, panel, panel 2, border, text, dim text, accent, win and loss (each row says what it changes);
- choose a **font style** (monospace, sans-serif, serif) and **text size** (small, medium, large);
- **save your own presets** (rename, delete; 20 by default, up to 100 if you accept the warning) and export / import them as a file;
- see a **readability** check for every pair: 4.5:1 or better is good, 3–4.5:1 is weak but allowed, under 3:1 is refused. A refused set simply waits — it applies by itself as soon as every pair passes, so you can move from a dark look to a light one one colour at a time;
- preset names use English / Spanish letters by default (a setting allows others).

Everything applies instantly and is remembered in this browser — your saved look is applied before the page first paints, so reloading or switching between the Basic and Advanced views never flashes the default Blue; exported HTML reports use your colours. An optional tour ("? How this works" in the panel) explains each part. Design notes: [docs/colour-customisation.md](docs/colour-customisation.md).

## Security and robustness

The tool reads text you paste or import, so nothing from a log or file is trusted:

- **Escaping.** Every value taken from a log, an import or saved settings is HTML-escaped before it is shown; the category editor and exported reports included.
- **Content-Security-Policy.** Both pages declare a policy that blocks inline scripts, plugins, `<base>` tags and form posts, and only allows this site's own files — so even a missed escape could not run code. Exported HTML reports carry their own policy with a fresh random nonce per export.
- **Imports are rebuilt, not trusted.** Every imported match is re-created from validated fields (real Session ID, clipped text, finite bounded numbers); malformed entries are skipped and counted rather than aborting the import.
- **Limits.** Lines are cut at 2,000 characters, one archived match at 256 KB, an imported file at 150 MB, and a `.gz` import may unpack to at most 128 MB (a tiny "gzip bomb" is refused while unpacking, without being expanded). Real logs are far below all of these (longest line 175 characters, largest match 8.5 KB).
- **Linear-time parsing.** Patterns are bounded so crafted input can't make the parser stall.
- **Tamper-tolerant settings.** Saved settings are validated when loaded; corrupted or hand-edited values fall back to defaults instead of breaking the page.
- **Names that look like code.** Lookups keyed by names from logs use prototype-free maps, so a map or vehicle called `constructor` is just a name.
- **Nothing leaves your device.** The pages make no network requests beyond loading their own files (and the optional example data).

## Tests

`tests/` holds a Playwright-based suite (parser, Basic view, Advanced view, storage, security, colours, theme flash, offline, build, performance) plus a **pre-change baseline** recorded before the security and performance work, and a comparison report of the current code against it. See [tests/README.md](tests/README.md). The app itself stays dependency-free.

## Project structure

```
wt-log-analyzer.html          Basic view markup
advanced.html                  Advanced view markup
css/styles.css                 Styling (both views)
dist/app-basic.js              GENERATED bundle: the whole Basic view (do not edit; see Development)
dist/app-advanced.js           GENERATED bundle: the whole Advanced view
dist/extras.js                 GENERATED bundle: colour panel, tutorials, service-worker registration (loaded after the core)
sw.js                          GENERATED service worker (offline use, instant return visits)
tools/build.js                 The build: concatenates javascript/ into dist/, stamps ?v= hashes, writes sw.js
tools/sw.template.js           Source of the service worker
javascript/load-guard.js       Tiny ES5 guard: "still loading" / "part of this page didn't load" notes with a Reload button
javascript/archive-worker.js   Web Worker: compresses / decompresses the archive and builds insight summaries off the main thread
javascript/sw-register.js      Registers the service worker and offers "New version ready — Reload"
javascript/util.js             Shared helpers: HTML escaping, limits, input sanitising (loaded first)
javascript/storage.js          localStorage persistence helpers
javascript/appearance-core.js  Look data (presets, validation) + applies the saved look; loaded in the <head>, before the stylesheet
javascript/themes.js           Appearance state, readability maths, saved presets, swatches (builds on the core)
javascript/categories.js       Battle-type category rules editor
javascript/detail-parser.js    Per-match detail parsing (parseDetail), no DOM access
javascript/db.js               Compressed raw-match archive (IndexedDB, localStorage fallback)
javascript/raw-export.js       Raw export / import, shared by both views
javascript/parser.js           Raw log parsing (parseLog)
javascript/math.js             Pure stat/goal math, no DOM access
javascript/goal-calculator.js  Goal calculator DOM wiring (Basic view)
javascript/import-export.js    File import + HTML/JSON export (Basic view)
javascript/main.js             App state, analyze() orchestration (Basic view)
javascript/advanced.js         Library, match detail, insights, storage panel (Advanced view)
javascript/appearance-panel.js  The Customise panel (colours, font, text size, my presets)
javascript/tutorial.js         Step-by-step tutorials (both views + the colour panel)
tests/                         Test suite, pre-change baseline and comparison reports (dev only)
docs/                          Design notes (colour customisation)
example data/                  Sample logs and exports for testing:
                                 matches.txt                    raw match-log text (84 matches)
                                 wt-session-data.json           minimal export (summaries only)
                                 wt-session-report-*.html       HTML report export (201 matches, summaries only)
index.html                     Redirects to wt-log-analyzer.html (for GitHub Pages' root URL)
```

## Development

Still vanilla HTML/CSS/JS with no dependencies and no package.json, but the pages now load **bundles** (`dist/`) instead of ~15 separate scripts, because on a slow connection every file is a round trip (see [the low-end report](tests/results/low-end-report.md)). The bundles are plain concatenations of `javascript/*.js` — nothing is minified or rewritten.

```
node tools/build.js            # after editing anything in javascript/: rebuild dist/, the ?v= hashes in the HTML, and sw.js
node tools/build.js --watch    # rebuild automatically while you edit
node tools/build.js --check    # change nothing; exit 1 if dist/ is out of date (what the tests use)
```

Commit `dist/` and `sw.js` with your change — GitHub Pages serves them as they are. The test runner rebuilds them first and the `build` suite fails if they were stale, so forgetting is caught. (The order of files in each bundle is in `tools/build.js`: classic scripts share one scope, so order matters.)

**The service worker** caches the app after the first visit so return visits are instant on any connection and the app works offline. It is **off on `localhost`** (so edits are never hidden behind a cache) unless you run `localStorage.setItem('wtSessionReadout.enableServiceWorkerLocally','true')` in the console. A new version installs quietly and waits; the page shows "A new version is ready — Reload" and nothing changes mid-session. It only touches caches starting `wt-tool-dev-`.

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](LICENSE).
