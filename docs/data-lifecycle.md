# Where your data goes

Everything the site keeps is in **your browser, on this device**. This page lists exactly what each action does, so nothing surprises you.

## The places data lives
| Place | Holds | Cleared by |
|---|---|---|
| **The paste box** | The text you pasted — remembered, and analyzed again automatically when you reopen the page | **Clear**, or you edit it |
| **Imported summaries** | Matches loaded from a minimal export or HTML report (no original text). Remembered and shown in both views | **Clear** (Basic view), or **Clear duplicate matches** for repeats |
| **The results on screen** | Totals computed from the paste box plus the imported summaries; rebuilt each time the page opens | **Clear** |
| **The archive** | The original text of every match you analyzed, compressed, plus small summaries | **Delete entire archive**, deleting single matches, clearing browser data |
| **Settings** | Battle-type rules, colours, font, text size, saved presets, tour "seen" flags | Clearing browser data, or Reset buttons for colours |
| **Offline copy of the site** | The site's own files | Clearing browser data |

## What each action does
| Action | Paste box | On-screen results | Archive | Settings |
|---|---|---|---|---|
| **Analyze** | kept | recomputed | adds new matches (existing ones skipped) | — |
| **Clear** | emptied (and forgotten) | cleared, imported summaries forgotten | **untouched** | — |
| **Load Example Data** | replaced with the sample | recomputed | adds the sample's matches | — |
| **Import Report** (Basic) | — | adds the imported matches | raw files add their matches; summary files are remembered as imported summaries (○) | — |
| **Import raw / log file** (Advanced) | — | — | adds new matches | — |
| **Export HTML / Minimal / Raw** | — | — | — (reads only) | — |
| **Clear duplicate matches** | — | — | removes repeats, keeps first | — |
| **Delete from archive** (one match) | — | — | removes that match | — |
| **Delete entire archive** | — | — | **empties it** | — |
| **Reset everything to default** (colours) | — | — | — | colours/font/size reset; presets kept |
| Changing a category rule | — | next Analyze | not changed | rules saved |

## The browser can clear things too
- **Site data cleared** (in browser settings, or by a "clean-up" app): archive and settings go.
- **Private or incognito windows** start empty and forget everything on close.
- **Low storage on the device**: browsers may evict site data in rare cases; the Advanced view's Storage section says when your data is protected from this.
- **Different address, different data.** The stable and Dev sites, and `localhost`, each have their own archive.

## Safe-keeping checklist
1. After a long session: **Export Raw**.
2. Before clearing browser data, changing phones, or resetting a browser: **Export Raw**.
3. Keep at least one old backup as well as the newest.
4. Check the Advanced view's Storage note: it tells you when your last backup was and how many matches were added since.

## Restoring
Use **Import Report** or **Import raw / log file** with a raw export. Matches already present are skipped; the rest are added. Colour presets and category rules are separate; see [Colours and text](colours-and-text.md) and [Battle-type categories](categories-guide.md).

## What is never stored
Nothing is sent to a server. Names in your logs appear only in your browser (and in files you choose to export).
