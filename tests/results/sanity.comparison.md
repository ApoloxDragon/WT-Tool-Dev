# Test comparison
Baseline: **pre-change** (commit e0bba8c, 2026-09-30T20:25:42.754Z)  
Current: **sanity** (commit ca2497f, 2026-10-01T17:47:18.697Z)

## Checks
| | baseline | current |
|---|---|---|
| passing | 50 / 81 | 260 / 260 |

### Fixed (failed before, pass now): 31
- ✅ basic › export right after Analyze › a raw export requested the instant Analyze runs still contains all 67 matches
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

### New checks: 179 (179 passing)

## Snapshots (behaviour on the example data)
19 identical, 1 changed on purpose, 0 changed unexpectedly.

- 🔧 basic › exports › HTML report body (time stamp and nonce normalised): e784e1d825a7ddc5 → 51fedc8d1f8f32f4
  - *intended:* The exported report now carries its own Content-Security-Policy meta tag and per-export script nonce, escapes the data, is styled with the active colours (all nine) and offers the eight presets (plus 'Your colours') in its own picker. With no special characters in the example data, the data sections are unchanged (see the 'data sections' snapshot).

## Timings
| metric | baseline ms | current ms | change |
|---|---:|---:|---:|
| security › resource limits › decompression bomb handling time — basic | 1308 | 363 | 0.28× 🟢 faster |
| security › resource limits › decompression bomb handling time — advanced | 1265 | 353 | 0.28× 🟢 faster |

## RESULT: no regressions
