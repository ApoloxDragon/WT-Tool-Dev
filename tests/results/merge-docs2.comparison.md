# Test comparison
Baseline: **pre-change** (commit e0bba8c, 2026-09-30T20:25:42.754Z)  
Current: **merge-docs2** (commit 6600965, 2026-10-15T01:11:09.836Z)

## Checks
| | baseline | current |
|---|---|---|
| passing | 100 / 137 | 1468 / 1468 |

### Fixed (failed before, pass now): 37
- ✅ parser › pathological input › finishes in under 1 second: one 120 KB line of repeated "Victory in the [" (no closing bracket)
- ✅ parser › pathological input › finishes in under 1 second: 12,000 short lines of "Victory in the [x" (no closing bracket)
- ✅ parser › pathological input › finishes in under 1 second: "Researched unit:" followed by a 40 KB line with no colon
- ✅ parser › pathological input › finishes in under 1 second: an event line that is 40,000 digits long
- ✅ basic › export right after Analyze › a raw export requested the instant Analyze runs still contains all 67 matches
- ✅ advanced › older archive records › …and their summaries are saved, so the next visit needn't read the raw text
- ✅ advanced › opening does not unpack the archive › opening the library (67 matches) decompresses nothing
- ✅ storage › corrupt data › all() skips a damaged record and still returns the good ones after it
- ✅ security › page structure › wt-log-analyzer.html: has a Content-Security-Policy that blocks inline scripts
- ✅ security › page structure › wt-log-analyzer.html: CSP forbids plugins, base-tag and form hijacking
- ✅ security › page structure › advanced.html: has a Content-Security-Policy that blocks inline scripts
- ✅ security › page structure › advanced.html: CSP forbids plugins, base-tag and form hijacking
- ✅ security › injection via pasted log (Basic) › mission + mode containing img payload renders as text
- ✅ security › injection via pasted log (Basic) › the hostile text is still visible (shown literally, not dropped)
- ✅ security › injection via pasted log (Basic) › mission + mode containing svg payload renders as text
- ✅ security › injection via pasted log (Basic) › mission + mode containing script payload renders as text
- ✅ security › injection via pasted log (Basic) › mission + mode containing attr payload renders as text
- ✅ security › injection via imported files (Basic) › minimal JSON with hostile category/mission/target/id renders as text
- ✅ security › injection via imported files (Basic) › goal-category dropdown options stay plain text
- ✅ security › injection via imported files (Basic) › the exported HTML report made from hostile data is inert when opened
- ✅ security › injection via imported files (Basic) › the exported report declares its own Content-Security-Policy
- ✅ security › injection via imported files (Basic) › HTML report with hostile category and session-id cells is inert
- ✅ security › injection via imported files (Basic) › raw export with hostile mission/mode is inert in Basic
- ✅ security › injection via category rules › a label containing quotes and tags is stored and shown exactly as typed
- ✅ security › injection via category rules › such a label is inert in the rules editor, tables and dropdown
- ✅ security › injection via category rules › and still inert after reload (it is persisted)
- ✅ security › property-name collisions › research targets called "constructor"/"toString" are summed as numbers (no NaN / function text)
- ✅ security › property-name collisions › a map named "constructor" gets a proper row in the Advanced by-map table
- ✅ security › property-name collisions › a vehicle named "constructor" gets a proper row in the by-vehicle table
- ✅ security › malformed imports › the valid entry is still analysed and the stats contain no NaN/Infinity
- ✅ security › tampered browser storage › Basic still loads when saved settings are the wrong type (no uncaught error)
- ✅ security › tampered browser storage › …and can still analyze the example log afterwards
- ✅ security › tampered browser storage › …and can still export an HTML report with a corrupted theme setting
- ✅ security › tampered browser storage › Advanced also loads with tampered settings (no uncaught error)
- ✅ security › resource limits › basic: a 160 KB → 160 MB gzip bomb is refused quickly with a clear message
- ✅ security › resource limits › advanced: a 160 KB → 160 MB gzip bomb is refused quickly with a clear message
- ✅ security › resource limits › a single 400 KB "match" is analysed but not written to the archive

### New checks: 1329 (1329 passing)

### Checks no longer run: 3
- perf › 200 matches › Analyze renders one row per match
- perf › 2000 matches › Analyze renders one row per match
- perf › 6000 matches › Analyze renders one row per match

## Snapshots (behaviour on the example data)
33 identical, 1 changed on purpose, 0 changed unexpectedly.

- 🔧 basic › exports › HTML report body (time stamp and nonce normalised): e784e1d825a7ddc5 → 662751d81988e837
  - *intended:* The exported report now carries its own Content-Security-Policy meta tag and per-export script nonce, escapes the data, is styled with the active colours (all nine) and offers the eight presets (plus 'Your colours') in its own picker. With no special characters in the example data, the data sections are unchanged (see the 'data sections' snapshot).

2 new snapshot(s) not in the baseline.

## Timings
| metric | baseline ms | current ms | change |
|---|---:|---:|---:|
| parser › pathological input › parse time — one 120 KB line of repeated "Victory in the [" (no closing bracket) | 1327.2 | 0.8 | 0.00× 🟢 faster |
| parser › pathological input › parse time — 12,000 short lines of "Victory in the [x" (no closing bracket) | 3879.5 | 1.4 | 0.00× 🟢 faster |
| parser › pathological input › parse time — "Researched unit:" followed by a 40 KB line with no colon | 2318.3 | 1 | 0.00× 🟢 faster |
| parser › pathological input › parse time — an event line that is 40,000 digits long | 25000 | 2.2 | 0.00× 🟢 faster |
| parser › pathological input › parse time — a 200 KB single line of plain text | 0.9 | 0.4 | 0.44× |
| security › resource limits › decompression bomb handling time — basic | 1308 | 284 | 0.22× 🟢 faster |
| security › resource limits › decompression bomb handling time — advanced | 1265 | 280 | 0.22× 🟢 faster |
| perf › 200 matches › parse the pasted log | 7 | 3.2 | 0.46× |
| perf › 200 matches › parse per-match detail for all matches | 29.7 | 21.1 | 0.71× |
| perf › 200 matches › write all matches to the archive | 385.7 | 102.2 | 0.26× 🟢 faster |
| perf › 200 matches › read + decompress the whole archive | 229.2 | 26.3 | 0.11× 🟢 faster |
| perf › 200 matches › archive stats() | 4.1 | 4.2 | 1.02× |
| perf › 200 matches › Analyze click (stats + every table) | 18.7 | 27.4 | 1.47× |
| perf › 200 matches › Advanced: open page until first library row shows | 366 | 127 | 0.35× 🟢 faster |
| perf › 200 matches › Advanced: open page and have every insight table filled | 376 | 148 | 0.39× 🟢 faster |
| perf › 200 matches › Advanced: re-render library after a filter change | 5.2 | 10.7 | 2.06× |
| perf › 200 matches › Advanced: open one match detail | 28.2 | 16.9 | 0.60× |
| perf › 2000 matches › parse the pasted log | 56.7 | 27.2 | 0.48× 🟢 faster |
| perf › 2000 matches › parse per-match detail for all matches | 207.8 | 134.8 | 0.65× |
| perf › 2000 matches › write all matches to the archive | 3816.4 | 770.9 | 0.20× 🟢 faster |
| perf › 2000 matches › read + decompress the whole archive | 2115.2 | 240.8 | 0.11× 🟢 faster |
| perf › 2000 matches › archive stats() | 25.6 | 37.9 | 1.48× |
| perf › 2000 matches › Analyze click (stats + every table) | 104.4 | 49.9 | 0.48× 🟢 faster |
| perf › 2000 matches › Advanced: open page until first library row shows | 3007 | 483 | 0.16× 🟢 faster |
| perf › 2000 matches › Advanced: open page and have every insight table filled | 3030 | 507 | 0.17× 🟢 faster |
| perf › 2000 matches › Advanced: re-render library after a filter change | 13.6 | 27.9 | 2.05× 🔺 slower |
| perf › 2000 matches › Advanced: open one match detail | 14.1 | 24.4 | 1.73× |
| perf › 6000 matches › parse the pasted log | 163.4 | 64.9 | 0.40× 🟢 faster |
| perf › 6000 matches › parse per-match detail for all matches | 561.5 | 362.4 | 0.65× |
| perf › 6000 matches › write all matches to the archive | 10151.7 | 2246.2 | 0.22× 🟢 faster |
| perf › 6000 matches › read + decompress the whole archive | 6380.7 | 751.7 | 0.12× 🟢 faster |
| perf › 6000 matches › archive stats() | 57.7 | 118.5 | 2.05× 🔺 slower |
| perf › 6000 matches › Analyze click (stats + every table) | 293.4 | 118 | 0.40× 🟢 faster |
| perf › 6000 matches › Advanced: open page until first library row shows | 8877 | 912 | 0.10× 🟢 faster |
| perf › 6000 matches › Advanced: open page and have every insight table filled | 8897 | 962 | 0.11× 🟢 faster |
| perf › 6000 matches › Advanced: re-render library after a filter change | 16.4 | 20.3 | 1.24× |
| perf › 6000 matches › Advanced: open one match detail | 7.2 | 17 | 2.36× |

## RESULT: no regressions
