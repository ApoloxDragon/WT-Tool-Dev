# Tests

Dev-only checks for the Session Readout tool. The app itself stays dependency-free; these need
[Playwright](https://playwright.dev) (local or global `npm i -g playwright`) and Chromium
(`WT_CHROMIUM=/path/to/chromium` if it isn't at `/opt/pw-browsers/chromium`).

```
node tests/run.js --label my-run                                   # run everything, save tests/results/my-run.json
node tests/run.js --label post --compare tests/baseline/pre-change.json   # …and compare with the baseline
node tests/run.js --only appearance,tutorial                       # just some suites
node tests/run.js --scale small                                    # smaller performance datasets (faster)
```

`dist/` and `sw.js` are rebuilt automatically before a run (see `tools/build.js`), and the `build` suite fails if the committed ones were stale. A static server and headless browser are started automatically; every test runs in a fresh browser
context, so storage always starts empty.

## Fake match logs (stress testing)

`tests/generate-matches.js` makes War Thunder-style logs of any size, so stress data never has to be written by hand.
Each match is random but typical (win rate, mode mix, missions, which sections appear and how the SL / RP figures
add up are modelled on the real example logs), and the same `--seed` always gives the same file. Everything is
labelled fake: a banner above the first match and Session IDs that all start `fade`.

```
node tests/generate-matches.js --count 10000 --out "example data/generated/fake-10k-matches.txt"
node tests/generate-matches.js --count 500 --dupes 0.1 --seed 5 --crlf --out fake.txt   # 10% repeated matches, CRLF
node tests/generate-matches.js --help
```

`--dupes F` adds `F × count` repeats of earlier matches (like overlapping pastes). Generated files are big, so
`example data/generated/` is git-ignored: generate them when you need them. The invariants suite always includes a
400-match generated log; `WT_FAKE_COUNT=10000 node tests/run.js --only invariants` adds a 10,000-match one
(PowerShell: `$env:WT_FAKE_COUNT=10000` first).

## What gets recorded

| kind | meaning | compared between runs |
|---|---|---|
| **check** | a yes/no statement of *desired* behaviour | pass → fail is a regression; fail → pass is a fix |
| **snapshot** | a fingerprint of what the app produces on the example data (tables, exports, parsed matches) | any difference is reported, naming the items that changed |
| **metric** | a timing in milliseconds | reported as a ratio; a 3× slowdown (over 100 ms) counts as a regression |

## Suites

| suite | covers |
|---|---|
| `parser` | log parsing and per-match detail on the 84 real matches; hostile and pathological input |
| `basic` | Analyze, goal calculator, categories, persistence, exports, every import format |
| `advanced` | library, filters, match detail, insights, storage panel, raw round trips |
| `storage` | the compressed archive, damaged records, localStorage fallback, no-storage mode |
| `security` | CSP, HTML injection through every input route, name collisions, malformed / tampered data, size limits |
| `appearance` | the eight presets, the Customise panel, every colour role, readability rules, fonts and sizes, saved presets (names, limits), preset files, tampered settings, reports |
| `flash` | a saved look is in place before the first paint on every view (Basic, Advanced, the redirect page), with the late script slowed down; no fade from the default |
| `tutorial` | the main tours and the colour tour on desktop and phone: placement, keyboard, opt-in behaviour |
| `menu` | the phone Menu: on a 390 px screen the top bar folds behind a Menu button (no sideways scrolling, tap targets, jump-to list, Escape / outside tap, swatches, Customise, view switch, the tutorial opening it for steps inside it, resizing to desktop); on a wide screen, and with JavaScript off, the top bar is unchanged |
| `site` | stable and dev as two sites on ONE origin (opened side by side, like github.io): which is which comes from the URL; storage (localStorage, IndexedDB), service-worker cache names, banner, `[DEV]` title, icons and the GitHub link are separate; the static files carry nothing dev-specific, so a Dev → main merge cannot change which site is which |
| `invariants` | **size-agnostic**: no check names a match count. An independent oracle (`oracle()` in `fixtures.js`) works the expected matches, duplicates, win rate, SL and RP out of each log's raw text; the app's parser, Analyze tables, archive, exports, re-imports and Advanced library must agree. Runs on both real example files (`matches.txt`, `matches-large.txt`) plus 1, 2, 37 and 1,001 synthetic matches, one match pasted 50 times, a log pasted twice, reversed block order, CRLF endings and junk between matches. Any example file added to the list in `datasets()` gets the same checks. |
| `build` | `dist/` and `sw.js` match the sources; every source is bundled exactly once, in a working order; page `?v=` hashes are current; size budgets (gzip) hold |
| `guard` | the load guard: "still loading" note on a slow load, an error note with Reload when a file fails, never shown once the page is ready |
| `offline` | the service worker: installs a versioned cache, the whole app (Analyze, archive, Advanced, insights) works with no network, updates wait for "Reload", only its own caches are touched, off on localhost unless flagged, a failed install leaves nothing behind. The test browser's offline switch doesn't reach service-worker requests, so the test server is taken down instead (`setDown`) |
| `lowend` *(opt-in)* | bad connections and slow processors: throttled page loads, CPU-throttled runtime at 200/2,000 matches, profiler hot spots, memory/DOM size, files that fail or stall. Run with `--only lowend` (parts: `LOWEND_PART=net,cpu,hot,mem,fail`; `LOWEND_SITE=/path/to/older/checkout` measures an older copy for a before/after). Findings in `tests/results/low-end-report.md` |
| `perf` | parse, archive, Analyze and Advanced-view timings at 200 / 2,000 / 6,000 matches |

## The before / after workflow

1. **Before changing code**, record the baseline: `node tests/run.js --label pre-change --out tests/baseline/pre-change.json`.
   Checks that describe *wanted* behaviour the code doesn't have yet (e.g. "hostile names are inert") are recorded as failures — that is the point.
2. Make changes.
3. **After**, run with `--compare tests/baseline/pre-change.json`. The report (`tests/results/<label>.comparison.md`) lists what was
   fixed, what regressed, which snapshots changed and how timings moved. Snapshots of the example data should stay identical unless a
   change is *meant* to alter output.

A snapshot that is *supposed* to change is listed in `tests/expected-changes.json` with the reason, so the report shows it as "changed on purpose" instead of a regression.

`tests/baseline/pre-change.json` was taken on commit `e0bba8c`, before the security / performance work, and is committed so the comparison stays reproducible. (It was re-recorded on that same unmodified code whenever a test itself was corrected — never on changed app code.) The latest full comparison is `tests/results/final.comparison.md` (0 regressions, 33 of 34 example-data snapshots identical and 1 changed on purpose).
