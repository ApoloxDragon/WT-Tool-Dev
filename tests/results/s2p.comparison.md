# Test comparison
Baseline: **pre-change** (commit e0bba8c, 2026-09-30T20:25:42.754Z)  
Current: **s2p** (commit 175fe04, 2026-10-01T18:08:22.106Z)

## Checks
| | baseline | current |
|---|---|---|
| passing | 12 / 12 | 12 / 12 |

### New checks: 3 (3 passing)

### Checks no longer run: 3
- perf › 200 matches › Analyze renders one row per match
- perf › 2000 matches › Analyze renders one row per match
- perf › 6000 matches › Analyze renders one row per match

## Snapshots (behaviour on the example data)
0 identical, 0 changed on purpose, 0 changed unexpectedly.


## Timings
| metric | baseline ms | current ms | change |
|---|---:|---:|---:|
| perf › 200 matches › parse the pasted log | 7 | 8.2 | 1.17× |
| perf › 200 matches › parse per-match detail for all matches | 29.7 | 31.5 | 1.06× |
| perf › 200 matches › write all matches to the archive | 385.7 | 128.5 | 0.33× 🟢 faster |
| perf › 200 matches › read + decompress the whole archive | 229.2 | 33.1 | 0.14× 🟢 faster |
| perf › 200 matches › archive stats() | 4.1 | 6.1 | 1.49× |
| perf › 200 matches › Analyze click (stats + every table) | 18.7 | 20.2 | 1.08× |
| perf › 200 matches › Advanced: open page until first library row shows | 366 | 174 | 0.48× 🟢 faster |
| perf › 200 matches › Advanced: open page and have every insight table filled | 376 | 186 | 0.49× 🟢 faster |
| perf › 200 matches › Advanced: re-render library after a filter change | 5.2 | 5.1 | 0.98× |
| perf › 200 matches › Advanced: open one match detail | 28.2 | 10.1 | 0.36× 🟢 faster |
| perf › 2000 matches › parse the pasted log | 56.7 | 67.1 | 1.18× |
| perf › 2000 matches › parse per-match detail for all matches | 207.8 | 240.3 | 1.16× |
| perf › 2000 matches › write all matches to the archive | 3816.4 | 1032.4 | 0.27× 🟢 faster |
| perf › 2000 matches › read + decompress the whole archive | 2115.2 | 287.4 | 0.14× 🟢 faster |
| perf › 2000 matches › archive stats() | 25.6 | 57.8 | 2.26× 🔺 slower |
| perf › 2000 matches › Analyze click (stats + every table) | 104.4 | 84.6 | 0.81× |
| perf › 2000 matches › Advanced: open page until first library row shows | 3007 | 452 | 0.15× 🟢 faster |
| perf › 2000 matches › Advanced: open page and have every insight table filled | 3030 | 496 | 0.16× 🟢 faster |
| perf › 2000 matches › Advanced: re-render library after a filter change | 13.6 | 14 | 1.03× |
| perf › 2000 matches › Advanced: open one match detail | 14.1 | 15.3 | 1.09× |
| perf › 6000 matches › parse the pasted log | 163.4 | 183.1 | 1.12× |
| perf › 6000 matches › parse per-match detail for all matches | 561.5 | 645.1 | 1.15× |
| perf › 6000 matches › write all matches to the archive | 10151.7 | 3838.1 | 0.38× 🟢 faster |
| perf › 6000 matches › read + decompress the whole archive | 6380.7 | 873.2 | 0.14× 🟢 faster |
| perf › 6000 matches › archive stats() | 57.7 | 152.5 | 2.64× 🔺 slower |
| perf › 6000 matches › Analyze click (stats + every table) | 293.4 | 220.7 | 0.75× |
| perf › 6000 matches › Advanced: open page until first library row shows | 8877 | 1061 | 0.12× 🟢 faster |
| perf › 6000 matches › Advanced: open page and have every insight table filled | 8897 | 1113 | 0.13× 🟢 faster |
| perf › 6000 matches › Advanced: re-render library after a filter change | 16.4 | 15.3 | 0.93× |
| perf › 6000 matches › Advanced: open one match detail | 7.2 | 16.2 | 2.25× |

## RESULT: no regressions
