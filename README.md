# WT Session Readout

A single-page, client-side tool for analyzing pasted War Thunder match-log text: it splits matches by battle type, dedupes repeated match reports (by Session ID), tallies RP by research target, and includes a goal calculator for estimating matches needed to hit an RP/SL target.

Everything runs locally in the browser — no server, no build step, no data leaves your machine.

## Usage

Open `wt-log-analyzer.html` in a browser. Keep it in the same folder as `css/` and `javascript/` — it loads `css/styles.css` and `javascript/app.js` as relative paths.

Paste one or more match reports (the "Victory/Defeat in the [Mode] ... mission!" through the "Session:" line) into the text box and click Analyze.

## Project structure

```
wt-log-analyzer.html   Markup only
css/styles.css         Styling
javascript/app.js      Parsing, analysis, goal calculator, import/export logic
example data/          Sample match-log text and exported session data for testing
```

## AI disclosure

This project was built with the assistance of Claude (Anthropic). Code changes, including bug fixes and the parsing logic, were written collaboratively with Claude rather than entirely by hand.

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) — see [LICENSE](LICENSE).
