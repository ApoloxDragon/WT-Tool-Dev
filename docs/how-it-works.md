# How it works

A short, plain-language tour of what is under the hood. You don't need any of this to use the site.

## The big picture
The site is a set of static web pages. Your browser downloads them once and runs everything locally. There is no server doing the analysis.

1. **Reading.** Pasted text is split into matches. Each match's headline, scoring events, costs, research lines, Session ID and Total line are read with careful, bounded patterns (so strange text can't make them run away).
2. **Checking.** Every value is cleaned and limited before it is used.
3. **Counting.** Duplicates (same Session ID) are set aside; the rest are totalled by battle type, research target and so on.
4. **Saving.** The original text of each match is compressed and stored in your browser's database, along with a small summary used for fast listing and insights.
5. **Showing.** Tables are built with all text escaped.

## The two views
- **Basic** works on what you paste (plus anything you import).
- **Advanced** works on the saved archive. It lists matches from the stored summaries without unpacking anything, and only decompresses a match when you open it.

## The archive
Each match is stored by its Session ID, so the same match can only exist once. Compression uses the browser's built-in gzip, done on a background worker so the page doesn't freeze. Insight tables use per-match rollups saved with each match; if the rollup format ever improves, old ones are rebuilt automatically. Summaries carry a version for the same reason.

## Colours
Colours are stored as nine values and applied to the page through CSS variables. A tiny script in the page head applies your saved look **before the first paint**, which is why there's no flash of the default theme. Readability is measured with standard contrast ratios.

## Speed and reliability features
- **Bundled files.** The pages load one core file each (plus an optional "extras" file), instead of ~15 separate ones.
- **Load guard.** A tiny script shows *still loading* or *part of this page didn't load* notes with a Reload button.
- **Background worker.** Compression and insight rollups run off the main thread, with a fallback if workers aren't available.
- **Service worker (offline cache).** After the first visit the whole app is cached under a version name. Updates wait for you to press **Reload**. It only ever touches caches that start with its own prefix. On `localhost` it's off unless you set a browser setting called *enableServiceWorkerLocally* to true.
- **Capped tables.** The Basic match table shows 200 rows at a time; the Advanced one 500.

## For people who change the site
The scripts the pages load are generated from the source files by a small build step, and tests rebuild them automatically and fail if they're stale. The project README explains the workflow, and the test suite README explains the checks (parsing, both views, storage, security, colours, theme flash, offline, build, phone menu, size-agnostic invariants and performance). The low-end investigation is in `tests/results/low-end-report.md`.

## Where the pieces are (plain overview)
| Piece | Job |
|---|---|
| Basic page and Advanced page | The two views |
| Stylesheet | Look and layout, including the phone and print layouts |
| Parsers | Read match logs and per-match detail |
| Archive | Compressed storage of raw matches |
| Appearance parts | Presets, readability rules, the Customise panel |
| Tutorial and phone menu | The tours and the Menu button |
| Load guard and offline cache | Reliability on bad connections |
