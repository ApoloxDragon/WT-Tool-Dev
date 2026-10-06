# The Basic view

The Basic view is the main page. It is where you paste logs and see session totals. (The page is called *Session Readout*.)

## The top bar
- **Advanced view →** opens the per-match view ([The Advanced view](advanced-view.md)).
- **? Tutorial** starts the guided tour of this page.
- **GitHub logo** opens the project's source page in a new tab.
- **Colour swatches and Customise…** change the look ([Colours and text](colours-and-text.md)).

On a narrow screen (a phone) these fold behind a **Menu** button that also lists the page's sections to jump to — see [Phone, offline and slow devices](phone-offline-and-slow-devices.md).

## The paste box and buttons
| Button | What it does |
|---|---|
| **Analyze** | Reads the pasted text and fills in every result below. Also saves the matches to your local archive. |
| **Clear** | Empties the paste box and the current results. Your saved archive is **not** touched. |
| **Load Example Data** | Fills the box with a sample session and analyzes it. Works on the hosted site; it cannot work when the page is opened straight from a file on disk. |
| **Print / Save PDF** | Opens your browser's print dialog for the results — see [Printing](#printing-and-save-as-pdf). Run Analyze first. |
| **Export HTML** | Downloads a standalone, themed report. See [Backups, import and export](backups-import-export.md). |
| **Minimal export** | A toggle: when on, the export button becomes **Export Data (minimal)** and saves a compact summary file instead. |
| **Export Raw** | Downloads the original match text from your archive — your real backup. |
| **Import Report** | Loads a previously exported file (or a plain text log). |

Small notes under the buttons report what happened (for example how many matches were archived, or why a file could not be read).

## Duplicate warning
If some pasted matches repeat (same Session ID), a warning says how many were left out of the totals. See [Reading your logs](reading-your-logs.md#session-ids-and-duplicates).

## Battle-type categories
Open **Battle-type categories** to see and edit the rules that put each match in a category.

- A rule is a **keyword** (looked for in the match's mode name) and a **label** (the category name to show).
- By default **Tank Assault** has its own category; anything not matched by a rule is **Random Battles**.
- To add one, type a keyword (for example *Arcade*) and a label (for example *Arcade Battles*), then **Add rule**. Existing matches are re-sorted next time you Analyze.
- Rules are remembered in your browser.

## Results

### Overall
Four tiles: **Matches** (unique matches counted), **Win rate**, **Total net SL** and **Total RP**.

### Battle type split
One row per category: matches, wins/losses, win percentage, total net SL, average SL per win and per loss, and total RP.

### Goal calculator
Estimates how many matches you need to reach a goal, using *your own* averages.

1. **Load averages from** — choose a battle type (or **All Combined**). Win rate, average win/loss RP and average win/loss SL are filled in from your data. You can edit any of them to ask "what if".
2. **RP goal remaining** and **SL goal remaining** — type what you still need (either or both).
3. **+30% RP Booster** — toggle if you use the booster; it multiplies expected RP by 1.3.

You get: expected RP and net SL per match, expected time per match, matches needed for each goal, and an estimated playtime. The big number is **matches needed for whichever goal takes longer**, labelled *RP-bound*, *SL-bound* or *tied*. Leave a goal empty to ignore it.

Tip: averages come from your own matches, so the estimate gets better with more data and with the right battle type chosen.

### RP by research target
A table of the RP that went toward unlocking new vehicles, largest first.

### Other RP
A collapsed section (click to expand) for RP that went to **modules and research progress** on other vehicles. It is separate on purpose.

### Per-match detail
Every match in the session, one row each: result, battle type, mode, mission, net SL, RP and target. Repeated matches appear **struck through** with the figures blanked and the note *DUPLICATE — excluded*.

For very large sessions the table first shows the first **200** rows; use **Show 500 more** or **Show all** under it. This keeps the page fast on slower devices. The totals above always cover **all** matches, and exports and printing always include every match.

## Printing and Save as PDF
**Print / Save PDF** uses your browser's print dialog (choose *Save as PDF* as the printer to make a file).

- The printout **keeps your chosen colour theme**.
- Buttons, the paste box and the "show more" row are left out.
- **Repeated (duplicate) matches are left out**, just like in the totals.
- Every match is included even if the screen only shows the first 200.
- Text size follows a fixed print size, not your on-screen text-size setting.

If you would rather save ink, switch to a light preset such as **Daylight** before printing. For a file you can share, **Export HTML** makes a standalone report.

## Session text is remembered
What you pasted is remembered in your browser, so refreshing the page does not lose it. **Clear** forgets it.
