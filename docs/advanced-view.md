# The Advanced view

The Advanced view reads the **archive** — every match you analyzed in the Basic view, saved in your browser. Open it from **Advanced view →**; **← Basic view** returns you. The two views share the same archive and the same look.

If the archive is empty, the page says so and points you to the Basic view (or to importing a raw export).

## Library
A table of every archived match.

- **Search** looks in mission, category and target.
- **Battle type** and **Win + loss / Victories / Defeats** narrow the list.
- **Sort**: newest first, oldest first, most SL, most RP or longest.
- **Detail only** shows only matches that have stored detail.
- Totals above the table follow the current filters.
- A **●** marks a match with full detail; a **○** marks a **summary-only** match (it came from a minimal export or an HTML report, which do not contain the original text).

The table shows the first 500 rows of the current filter, with a way to show all. Searching and filtering never needs to unpack your archive, so it stays quick.

## Match detail
*Section-by-section guide: [Reading a match's detail](match-detail-guide.md).*

Click a ● row to open that match's full breakdown:

- net and earned SL, with repair, ammunition and respawn costs;
- a per-vehicle table;
- every scoring event — time, vehicle, weapon, target, SL and RP (**hover an amount** to see its base, premium-account and booster parts);
- flat rewards, research progress and used items;
- the original log text.

Buttons let you **copy the raw text**, **export this match** (raw), or **delete it** (it asks first; a deleted match is only recoverable from a raw export). **Esc** or **Close ✕** closes the panel.

## Insights
*Column-by-column guide: [Insights explained](insights-guide.md).*

Statistics across the whole archive, in three collapsible tables:

- **By map** — results per map.
- **By vehicle** — time and kills per vehicle.
- **Earnings by event type** — which kinds of events earn the most SL and RP.

The vehicle and event tables only use matches that have stored detail (●). They are filled in when you open them, using small summaries saved with each match, so they appear quickly even for big archives.

## Storage
Shows how much your archive uses and how well it compresses, the browser's storage allowance, and whether you have a recent backup.

| Button | What it does |
|---|---|
| **Export raw (.json.gz)** | The smallest lossless backup. |
| **Export raw (.json)** | The same data uncompressed (readable, larger). |
| **Import raw / log file** | Adds matches from a raw export or a plain log file. Matches already in the archive are skipped. |
| **Clear duplicate matches** | Removes repeats (same Session ID) from your saved session and imported matches, keeping the first copy of each. |
| **Delete entire archive** | Empties the archive (asks first). |

Summary-only files (minimal export, HTML report) cannot be imported here because they contain no raw text; import those in the Basic view instead.

### Where is the archive?
In your browser, on this device only ([Privacy and safety](privacy-and-safety.md)). If your browser cannot use its main database, a smaller fallback of roughly 5 MB is used, and if nothing works the site keeps working for the current session without saving.
