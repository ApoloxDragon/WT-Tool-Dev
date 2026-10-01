# Low-end devices and bad connections — findings

Measured with `node tests/run.js --only lowend` (opt-in; parts: `net`, `cpu`, `hot`, `mem`, `fail`; `LOWEND_SITE=/path` measures an older checkout). Chromium's built-in throttling stands in for real conditions, so read these as **relative** numbers — they show where the time goes and what would help, not what a specific phone will do. The sections after the results below are the **original findings, measured on the code before any of the fixes**; all eight candidates have since been implemented and re-measured.

| profile | connection | processor |
|---|---|---|
| Slow 4G, mid-range phone | 1.6 Mbit/s, 150 ms round trip | 4× slower |
| Slow 3G, low-end phone | 400 kbit/s, 400 ms round trip | 6× slower |
| Awful 2G-like, very low-end phone | 100 kbit/s, 1,500 ms round trip | 20× slower |

## Results after implementing all eight candidates
Same machine, same throttling profiles, same test. "Before" = the code at `e095d20` (separate scripts, no service worker); "after" = this branch. Milliseconds unless stated. Read as relative numbers (see above).

### First visit to the Basic page (controls usable)
| profile | before | after | first paint before → after |
|---|---:|---:|---:|
| Slow 4G, 4× CPU | 2,724 | **1,119** | 628 → 804 |
| Slow 3G, 6× CPU | 7,203 | **3,302** | 1,604 → 2,088 |
| Awful 2G-like, 20× CPU | 27,138 | **12,738** | 6,048 → 7,764 |

Requests 18 → 7; data over the wire unchanged at about 58 KB. **First paint is a little later** (about +25%): the script bundle now downloads at the same time as the stylesheet and they share a slow link. Marking the bundle low-priority (`fetchpriority="low"`) was tried and made no difference, so it was not kept. Being *usable* 2× sooner is worth more than painting 1.7 s earlier on a 100 kbit/s link, and the saved theme is still on every painted frame (checked in all profiles).

### Return visits
| | before | after |
|---|---:|---:|
| 4G/3G/awful, HTTP cache still fresh (≤10 min) | 97–150 / 698 | 89–167 / 698 (unchanged) |
| **Awful 2G-like, 20× CPU, after the 10-minute cache expired** | **≈24,000** | **857** (service worker) |
| **No connection at all** | page doesn't load | **works** (open, Analyze, archive, Advanced, insights; checked in the `offline` suite) |

### Big sessions (2,000 matches; before → after)
Measured with the improved test (pasting 3.5 MB into the textarea is no longer counted as "Analyze" — that is the browser's own cost, see "Still open" below), so both columns are the *same* test run on old and new code.

| step | 1× | 4× | 6× | 20× |
|---|---:|---:|---:|---:|
| Analyze: click until the screen updates | 411 → 203 | 2,249 → 1,249 | 3,114 → 1,800 | 12,715 → 6,158 |
| Analyze: until saved to the archive | 2,256 → 1,327 | 11,969 → 2,797 | 19,540 → 3,652 | 79,395 → 10,093 |
| **fill the vehicle + event insights** | 1,572 → **27** | 9,357 → **57** | 15,561 → **73** | 64,880 → **466** |
| switch colour preset | 949 → 419 | 2,914 → 1,934 | 4,312 → 2,895 | 14,668 → 10,138 |
| open the colour panel | 676 → 605 | 3,874 → 3,243 | 6,140 → 4,457 | 16,655 → 16,560 |
| open Advanced until the first row | 420 → 401 | 1,220 → 1,365 | 1,993 → 2,152 | 7,370 → 6,991 |

With 200 matches: Analyze is unchanged (about 76–95 ms at 1×), the archive finishes 2.5–3× sooner (20×: 7.8 s → 2.5 s), insights are 7–20× faster. Memory: page elements at 2,000 matches 18,295 → 2,087 (and 54,295 → 2,087 at 6,000); JS heap after Analyze 31.3 → 22.6 MB at 2,000 and 72.7 → 65.1 MB at 6,000 (the pasted text itself is 3.5 / 10 MB).

Honest summary: the biggest wins are **insights (20–140× faster)**, **archive saving off the main thread** (the long freezes after Analyze are gone: the profiler shows two short tasks of 118 ms and 60 ms), **first usable load (2×)** and **return visits (≈28×, and offline)**. Analyze and the screen updates improved about 2×, not the 5–10× predicted — see below for why.

### Still open (not done — a decision for you)
- **The big pasted text itself is now the main cost of colour/preset changes on huge sessions.** With 2,000 matches the textarea holds 3.5 MB; every time the page is restyled the browser re-lays out that text: switching preset costs ~1,100 ms at 4× with the text in the box vs ~130 ms with the box empty (measured). CSS containment tricks only got ~40% back, so they weren't added. The real fix would change behaviour: after Analyze, replace a very large pasted log with a short placeholder ("2,000 matches analysed — paste again to add more"), keeping the text in the archive. This is a draft idea, **not implemented**, because it changes what people see in the box. Real sessions are far smaller than 2,000 matches (200 matches = 364 KB: preset switch 70 ms at 1×).
- Opening the colour panel at 2,000 matches shows the same textarea effect.

### Files that fail or stall (new structure: one core bundle, one deferred extras bundle, one worker file)
| missing | result |
|---|---|
| `dist/extras.js` (tutorial, colour panel, import/export, archive tools) | page and Analyze work; the optional features are simply absent |
| `javascript/archive-worker.js` | Analyze works; compression falls back to the main thread |
| `css/styles.css` | Analyze works; a "part of this page didn't load" note with a Reload button |
| `dist/app-basic.js` (the core) | **a visible note with a Reload button** instead of a silently dead page (this was the old "page is dead, no message" case) |
| `extras.js` hangs for 12 s | Analyze is available after 165 ms (it was *not usable within 9 s* when the middle script `db.js` hung) |
| core bundle takes 6 s | usable at 6.1 s, with the "still loading" note after 3.5 s |

The old `raw-export.js` → Analyze coupling is gone (Analyze never waits on or calls the archive), and a failed example load now reports the real reason instead of always blaming `file://`.

### What was implemented
| # | candidate | status |
|---|---|---|
| 1 | bundle the scripts | ✅ `tools/build.js` → `dist/app-basic.js`, `app-advanced.js`, `extras.js` (committed; tests rebuild and fail on a stale `dist/`) |
| 2 | cap the Basic table | ✅ first 200 rows, "show 500 more" / "show all"; exports unaffected |
| 3 | insights from stored summaries | ✅ rollup stored with each match (versioned; old records are rebuilt once) |
| 4 | compress off the main thread | ✅ `archive-worker.js`, with a main-thread fallback and timeout |
| 5 | service worker | ✅ versioned cache, updates wait for "Reload", off on localhost unless flagged |
| 6 | guard optional features + notice | ✅ `load-guard.js`; Analyze no longer depends on the archive script |
| 7 | Blob-free decompress | ✅ done as part of the worker work |
| 8 | fix the misleading `file://` message | ✅ |

---

# Original findings (before the fixes)

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

## Optimisation candidates (all implemented — see the results at the top)
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
