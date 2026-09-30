# Tests

Dev-only checks for the Session Readout tool. The app itself stays dependency-free; these need
[Playwright](https://playwright.dev) (local or global `npm i -g playwright`) and Chromium
(`WT_CHROMIUM=/path/to/chromium` if it isn't at `/opt/pw-browsers/chromium`).

```
node tests/run.js --label my-run                                   # run everything, save tests/results/my-run.json
node tests/run.js --label post --compare tests/baseline/pre-change.json   # …and compare with the baseline
node tests/run.js --only parser,security                           # just some suites
node tests/run.js --scale small                                    # smaller performance datasets (faster)
```

A static server and headless browser are started automatically; every test runs in a fresh browser
context, so storage always starts empty.

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
