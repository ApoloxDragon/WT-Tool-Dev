# Low-end devices and bad connections — findings

Measured with `node tests/run.js --only lowend` (opt-in; parts: `net`, `cpu`, `hot`, `mem`, `fail`, `exp`). Chromium's built-in throttling stands in for real conditions, so read these as **relative** numbers — they show where the time goes and what would help, not what a specific phone will do. **No app code was changed for this report.**

| profile | connection | processor |
|---|---|---|
| Slow 4G, mid-range phone | 1.6 Mbit/s, 150 ms round trip | 4× slower |
| Slow 3G, low-end phone | 400 kbit/s, 400 ms round trip | 6× slower |
| Awful 2G-like, very low-end phone | 100 kbit/s, 1,500 ms round trip | 20× slower |

Text is gzip-compressed and cached for 10 minutes by the test server, like GitHub Pages. The page is **about 55–60 KB** over the wire on a first visit (16–18 requests).

## What already holds up
- **No flash of the wrong theme on any connection** — the saved look is on every painted frame in all 18 profile/page/visit combinations, including the awful one.
- **Return visits are fast** while the cache is fresh: usable in 0.1–0.2 s on the 4G/3G profiles and 0.6–0.9 s on the awful one.
- **Optional features fail gracefully**: with the tutorial, colour panel, archive (`db.js`), detail parser or import/export script missing, Analyze still works.

## 1. First visit: the page *looks* ready long before it *is*
Basic view, first visit (ms):

| profile | first paint | controls usable | gap |
|---|---:|---:|---:|
| none (control) | 52 | 74 | 22 |
| Slow 4G | 628 | 2,724 | 2,096 |
| Slow 3G | 1,604 | 7,203 | 5,599 |
| Awful 2G-like | 6,048 | 27,138 | **21,090** |

The page paints, but every button is dead until all ~15 script files have arrived and run, so someone tapping Analyze early gets nothing. After the 10-minute cache expires, every file is re-checked, which costs almost as much (Slow 3G 6.4 s, awful 24 s).

**Experiment — one bundled script file instead of ~15** (same code, concatenated; first visit / after cache expiry, controls usable, ms; requests):

| protocol | connection | separate files (now) | one bundle |
|---|---|---:|---:|
| HTTP/1.1 | Slow 3G | 7,294 / 6,443 (18 / 17 req) | **2,354 / 1,427** (5 / 4 req) |
| HTTP/1.1 | Awful | 27,499 / 24,013 | **9,077 / 5,243** |
| HTTP/2 | Slow 3G | 7,197 / 6,465 | **2,390 / 1,410** |
| HTTP/2 | Awful | 27,743 / 24,137 | **9,075 / 5,148** |

A bundle makes the page usable about **3× sooner** on a first visit and about **5× sooner** after the cache expires, with HTTP/1.1 and HTTP/2 alike in this simulation. (DevTools throttling charges latency per request; a real HTTP/2 connection may be kinder to many small files than this model, so the real gain is probably smaller — but the direction is clear.)

## 2. Big sessions: layout, not logic, is the cost
Analyze with 2,000 matches (ms) — the app's own JavaScript is small; the browser's layout/paint of the table is not:

| step | 1× | 4× | 6× | 20× |
|---|---:|---:|---:|---:|
| Analyze: compute + build tables | 114 | 513 | 733 | 2,566 |
| **Analyze: click until the screen updates** | 1,636 | 7,278 | 10,821 | **35,074** |
| switch colour preset (with results showing) | 1,045 | 4,142 | 4,951 | 14,923 |
| open the colour panel | 709 | 3,609 | 5,436 | 23,645 |
| open Advanced until the first row | 405 | 1,402 | 2,116 | 6,339 |
| open one match's detail | 42 | 133 | 185 | 672 |
| fill the vehicle + event insights | 1,751 | 9,985 | 17,404 | **67,505** |

With 200 matches the same steps are 174 / 83 / 112 ms at 1× (4.8 s / 2.0 s / 2.6 s at 20×).

Profiler (2,000 matches, no throttling): during Analyze ~65% of the time is the browser's own work (`(program)`: style, layout, paint) and only 44 ms is `analyze()`; the saving of the archive costs another ~0.8 s of main-thread time (compression: `gzip` 600 ms + `CompressionStream` 224 ms); in the insights, ~20% is building a `Blob` per stored match, ~10% parsing.

| matches | page elements | per-match table rows | JS heap |
|---|---:|---:|---:|
| 200 | 2,095 | 201 | 6.8 MB |
| 2,000 | 18,295 | 2,001 | 31.3 MB |
| 6,000 | 54,295 | 6,001 | 72.7 MB |

The Basic view builds a row for **every** match (the Advanced view already stops at 500). Anything that makes the browser re-style the page — switching preset, opening the panel (which nudges the layout) — pays for all of them.

## 3. When a script doesn't arrive
One script missing at a time (Basic view):

| missing | result |
|---|---|
| tutorial, colour panel, `db.js`, detail parser, import/export | page works (archive not saved without `db.js`) |
| `appearance-core.js` | Analyze works, saved look lost |
| **`raw-export.js`** | **Analyze breaks** — it only handles backups, but Analyze calls into it |
| `util`, `storage`, `parser`, `math`, `categories`, `goal-calculator`, `main` | the page is dead; in several cases no message at all |

Stalls: scripts run strictly in order, so a **stalled file in the middle blocks everything after it**. A hung last script costs nothing (Analyze ready in 0.16 s); a hung `db.js` (middle) leaves the app dead for the whole stall (not usable within 9 s); a slow first script delays everything equally (6 s stall → usable at 6.1 s). Separately, if loading the example fails for *any* reason, the message blames `file://` even when the real cause is a missing script.

## Optimisation candidates (nothing done yet)
| # | idea | evidence | expected payoff | effort / risk |
|---|---|---|---|---|
| 1 | **Bundle the scripts** (one file per page, plus the early look script) | experiment above | usable ~3–5× sooner on slow links; 18 → 5 requests; one failure mode instead of many | small; needs a tiny build/concat step (the project has none today) or a committed bundle |
| 2 | **Cap the Basic per-match table** (e.g. first 200 rows + "show all"), as Advanced does | DOM 18k→~2k nodes; 200-match numbers above | Analyze → screen, preset switching and panel opening ≈ 5–10× cheaper at 2,000 matches; ~4× less memory | small; behaviour change (rows hidden until "show all"); exports unaffected |
| 3 | **Insights from stored summaries** (keep vehicle / event totals in each match's summary) | profiler + insights row | 1.75 s (67 s at 20×) → milliseconds; no archive read | medium; summary grows a little; version bump rebuilds old ones |
| 4 | **Compress off the main thread** (Web Worker) or in bigger batches | profiler: ~0.8 s per 2,000 matches | no jank after Analyze | medium |
| 5 | **Service worker** (serve the app from a local cache, refresh in the background) | "after cache expiry" rows | return visits instant even after 10 min (≈ the warm-cache numbers); works offline | medium; update/versioning rules to get right |
| 6 | **Guard optional features and show a notice** if a script is missing (e.g. don't let Analyze depend on `raw-export.js`; "part of this page didn't load — reload") | failure table | no silent dead page; the `raw-export` coupling fixed | small |
| 7 | Decompress without a `Blob` per record | profiler | a few hundred ms per 2,000 matches | small |
| 8 | Fix the misleading `file://` message for non-file errors | failure notes | clearer errors | tiny |
