# Test comparison
Baseline: **pre-change** (commit e0bba8c, 2026-09-30T20:25:42.754Z)  
Current: **final** (commit 3727790, 2026-10-01T18:42:52.485Z)

## Checks
| | baseline | current |
|---|---|---|
| passing | 100 / 137 | 1234 / 1234 |

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

### New checks: 1095 (1095 passing)

### Checks no longer run: 3
- perf › 200 matches › Analyze renders one row per match
- perf › 2000 matches › Analyze renders one row per match
- perf › 6000 matches › Analyze renders one row per match

## Snapshots (behaviour on the example data)
33 identical, 1 changed on purpose, 0 changed unexpectedly.

- 🔧 basic › exports › HTML report body (time stamp and nonce normalised): e784e1d825a7ddc5 → 51fedc8d1f8f32f4
  - *intended:* The exported report now carries its own Content-Security-Policy meta tag and per-export script nonce, escapes the data, is styled with the active colours (all nine) and offers the eight presets (plus 'Your colours') in its own picker. With no special characters in the example data, the data sections are unchanged (see the 'data sections' snapshot).

2 new snapshot(s) not in the baseline.

## Timings
| metric | baseline ms | current ms | change |
|---|---:|---:|---:|
| parser › pathological input › parse time — one 120 KB line of repeated "Victory in the [" (no closing bracket) | 1327.2 | 0.5 | 0.00× 🟢 faster |
| parser › pathological input › parse time — 12,000 short lines of "Victory in the [x" (no closing bracket) | 3879.5 | 2.4 | 0.00× 🟢 faster |
| parser › pathological input › parse time — "Researched unit:" followed by a 40 KB line with no colon | 2318.3 | 1.6 | 0.00× 🟢 faster |
| parser › pathological input › parse time — an event line that is 40,000 digits long | 25000 | 3 | 0.00× 🟢 faster |
| parser › pathological input › parse time — a 200 KB single line of plain text | 0.9 | 0.6 | 0.67× |
| security › resource limits › decompression bomb handling time — basic | 1308 | 340 | 0.26× 🟢 faster |
| security › resource limits › decompression bomb handling time — advanced | 1265 | 316 | 0.25× 🟢 faster |
| perf › 200 matches › parse the pasted log | 7 | 8.3 | 1.19× |
| perf › 200 matches › parse per-match detail for all matches | 29.7 | 39.5 | 1.33× |
| perf › 200 matches › write all matches to the archive | 385.7 | 132.8 | 0.34× 🟢 faster |
| perf › 200 matches › read + decompress the whole archive | 229.2 | 32.1 | 0.14× 🟢 faster |
| perf › 200 matches › archive stats() | 4.1 | 6.6 | 1.61× |
| perf › 200 matches › Analyze click (stats + every table) | 18.7 | 20.1 | 1.07× |
| perf › 200 matches › Advanced: open page until first library row shows | 366 | 132 | 0.36× 🟢 faster |
| perf › 200 matches › Advanced: open page and have every insight table filled | 376 | 148 | 0.39× 🟢 faster |
| perf › 200 matches › Advanced: re-render library after a filter change | 5.2 | 5 | 0.96× |
| perf › 200 matches › Advanced: open one match detail | 28.2 | 29.3 | 1.04× |
| perf › 2000 matches › parse the pasted log | 56.7 | 65.9 | 1.16× |
| perf › 2000 matches › parse per-match detail for all matches | 207.8 | 223.5 | 1.08× |
| perf › 2000 matches › write all matches to the archive | 3816.4 | 1031.1 | 0.27× 🟢 faster |
| perf › 2000 matches › read + decompress the whole archive | 2115.2 | 264 | 0.12× 🟢 faster |
| perf › 2000 matches › archive stats() | 25.6 | 55.4 | 2.16× 🔺 slower |
| perf › 2000 matches › Analyze click (stats + every table) | 104.4 | 84.3 | 0.81× |
| perf › 2000 matches › Advanced: open page until first library row shows | 3007 | 398 | 0.13× 🟢 faster |
| perf › 2000 matches › Advanced: open page and have every insight table filled | 3030 | 416 | 0.14× 🟢 faster |
| perf › 2000 matches › Advanced: re-render library after a filter change | 13.6 | 14 | 1.03× |
| perf › 2000 matches › Advanced: open one match detail | 14.1 | 17.6 | 1.25× |
| perf › 6000 matches › parse the pasted log | 163.4 | 184.7 | 1.13× |
| perf › 6000 matches › parse per-match detail for all matches | 561.5 | 637.2 | 1.13× |
| perf › 6000 matches › write all matches to the archive | 10151.7 | 3372.3 | 0.33× 🟢 faster |
| perf › 6000 matches › read + decompress the whole archive | 6380.7 | 831.8 | 0.13× 🟢 faster |
| perf › 6000 matches › archive stats() | 57.7 | 107 | 1.85× |
| perf › 6000 matches › Analyze click (stats + every table) | 293.4 | 207.1 | 0.71× |
| perf › 6000 matches › Advanced: open page until first library row shows | 8877 | 1233 | 0.14× 🟢 faster |
| perf › 6000 matches › Advanced: open page and have every insight table filled | 8897 | 1287 | 0.14× 🟢 faster |
| perf › 6000 matches › Advanced: re-render library after a filter change | 16.4 | 14.1 | 0.86× |
| perf › 6000 matches › Advanced: open one match detail | 7.2 | 16.9 | 2.35× |

## RESULT: no regressions