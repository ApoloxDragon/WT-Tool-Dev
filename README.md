# WT Session Readout

> ⚠️ **Development version.** This is the `Dev` branch — used for testing in-progress changes before they reach the stable release. Features here may be incomplete, broken, or change without notice, and data-affecting bugs are more likely than on the stable version. For the stable release, use [the main branch / production site](https://apoloxdragon.github.io/WarThunder-Tool/) instead.

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
- Walk you through all of it with a built-in step-by-step tutorial (opens on your first visit; reopen any time from **? Tutorial**)

Everything runs locally in the browser — no server, no build step, no account, no data leaves your machine (except when you explicitly export a file). The match archive is stored in your browser only (IndexedDB) and is never uploaded.

**Dev preview:** https://apoloxdragon.github.io/WT-Tool-Dev/ (this branch, unstable)
**Stable release:** https://apoloxdragon.github.io/WarThunder-Tool/

## Usage

Open `wt-log-analyzer.html` in a browser (or use one of the demos above). Keep it in the same folder as `css/` and `javascript/` if running locally — it loads its stylesheet and scripts as relative paths.

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
- **Storage** — archive size and compression, browser quota, backup status, raw export / import, and delete-all.

### Local storage

Each match's raw text is gzip-compressed (native `CompressionStream`, no library) and stored in IndexedDB under its Session ID. If IndexedDB is unavailable a small `localStorage` fallback (about 5 MB) is used, and if neither works the tool still runs — it just can't save detail. The **Clear** button only resets the current session; the archive is managed from the Advanced view's storage panel.

The archive exists only in your browser on this device: clearing site data deletes it and it doesn't sync. **Export Raw regularly as your backup.** The dev build uses its own database name, so it can't touch the stable site's data.

## Project structure

```
wt-log-analyzer.html          Basic view markup
advanced.html                  Advanced view markup
css/styles.css                 Styling (both views)
javascript/storage.js          localStorage persistence helpers (loaded first)
javascript/themes.js           Theme system + picker
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
javascript/tutorial.js         Step-by-step tutorial for both views
example data/                  Sample logs and exports for testing:
                                 matches.txt                    raw match-log text (84 matches)
                                 wt-session-data.json           minimal export (summaries only)
                                 wt-session-report-*.html       HTML report export (201 matches, summaries only)
index.html                     Redirects to wt-log-analyzer.html (for GitHub Pages' root URL)
```

## Development

No build step. Edit the files directly and reload the page — there's no bundler, no dependencies, no package.json. The whole thing is vanilla HTML/CSS/JS.

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](LICENSE).
