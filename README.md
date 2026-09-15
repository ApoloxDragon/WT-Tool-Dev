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

Everything runs locally in the browser — no server, no build step, no account, no data leaves your machine (except when you explicitly export a file).

**Dev preview:** https://apoloxdragon.github.io/WT-Tool-Dev/ (this branch, unstable)
**Stable release:** https://apoloxdragon.github.io/WarThunder-Tool/

## Usage

Open `wt-log-analyzer.html` in a browser (or use one of the demos above). Keep it in the same folder as `css/` and `javascript/` if running locally — it loads its stylesheet and scripts as relative paths.

Paste one or more match reports — from "Victory/Defeat in the [Mode] ... mission!" through the "Session:" and "Total:" lines — into the text box and click **Analyze**. No local data? Click **Load Example Data** to try it with the sample log in `example data/` (this only works on a server/hosted page, not when the file is opened directly from disk, since browsers block that fetch over `file://`).

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
- **Export Data (minimal)** (toggle next to Export) produces a compact JSON file with short keys, meant for re-uploading later to continue a session.
- **Import Report** accepts either of the above file types and merges them into the current session, skipping anything already loaded (matched by Session ID).

## Project structure

```
wt-log-analyzer.html          Markup only
css/styles.css                 Styling
javascript/storage.js          localStorage persistence helpers (loaded first)
javascript/themes.js           Theme system + picker
javascript/categories.js       Battle-type category rules editor
javascript/parser.js           Raw log parsing (parseLog)
javascript/math.js             Pure stat/goal math, no DOM access
javascript/goal-calculator.js  Goal calculator DOM wiring
javascript/import-export.js    File import + HTML/JSON export
javascript/main.js             App state, analyze() orchestration
example data/                  Sample match-log text and exported session data for testing
index.html                     Redirects to wt-log-analyzer.html (for GitHub Pages' root URL)
```

## Development

No build step. Edit the files directly and reload the page — there's no bundler, no dependencies, no package.json. The whole thing is vanilla HTML/CSS/JS.

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](LICENSE).
