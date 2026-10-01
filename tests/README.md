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

A static server and headless browser are started automatically; every test runs in a fresh browser
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
| `invariants` | **size-agnostic**: no check names a match count. An independent oracle (`oracle()` in `fixtures.js`) works the expected matches, duplicates, win rate, SL and RP out of each log's raw text; the app's parser, Analyze tables, archive, exports, re-imports and Advanced library must agree. Runs on both real example files (`matches.txt`, `matches-large.txt`) plus 1, 2, 37 and 1,001 synthetic matches, one match pasted 50 times, a log pasted twice, reversed block order, CRLF endings and junk between matches. Any example file added to the list in `datasets()` gets the same checks. |
| `perf` | parse, archive, Analyze and Advanced-view timings at 200 / 2,000 / 6,000 matches |

## The before / after workflow

1. **Before changing code**, record the baseline: `node tests/run.js --label pre-change --out tests/baseline/pre-change.json`.
   Checks that describe *wanted* behaviour the code doesn't have yet (e.g. "hostile names are inert") are recorded as failures — that is the point.
2. Make changes.
3. **After**, run with `--compare tests/baseline/pre-change.json`. The report (`tests/results/<label>.comparison.md`) lists what was
   fixed, what regressed, which snapshots changed and how timings moved. Snapshots of the example data should stay identical unless a
   change is *meant* to alter output.

A snapshot that is *supposed* to change is listed in `tests/expected-changes.json` with the reason, so the report shows it as "changed on purpose" instead of a regression.

`tests/baseline/pre-change.json` was taken on commit `e0bba8c`, before the security / performance work, and is committed so the comparison stays reproducible. (It was re-recorded on that same unmodified code whenever a test itself was corrected — never on changed app code.) The latest comparison is `tests/results/post-change.comparison.md`.
