# Backups, import and export

Your match archive lives only in your browser on one device. These are the ways to keep it safe and to move data around.

## The four kinds of file

| Export | Where | What it holds | Can it be re-imported? | Good for |
|---|---|---|---|---|
| **Export Raw** (.json.gz) | Basic and Advanced | The **original text** of every archived match | Yes — rebuilds everything | **Backups.** Smallest and lossless. |
| **Export raw (.json)** | Advanced | The same, uncompressed | Yes | Readable backups |
| **Export HTML** | Basic | A themed, printable report of the current session's unique matches | Yes (summaries only) | Sharing or archiving a readable report |
| **Export Data (minimal)** | Basic (toggle) | Compact summaries only | Yes (summaries only) | Carrying a session's totals to another paste session |

Summary-only files lack the original text, so matches imported from them show as **○** in the Advanced view and have no match detail.

**Why raw is best:** importing a raw file re-reads every match from scratch, so an old backup keeps getting richer as the site learns to read more detail.

## Importing
Use **Import Report** (Basic) or **Import raw / log file** (Advanced).

- The Basic view accepts raw exports, minimal exports, HTML reports and plain `.txt` logs.
- The Advanced view accepts raw exports and plain logs.
- Everything is **checked** on import: anything that does not look like a real match is skipped (and counted), never loaded blindly.
- Matches already in your archive are **skipped**, so importing twice does not duplicate anything.
- Very large files are refused with a message (the limits are in [Privacy and safety](privacy-and-safety.md#limits)).

## Moving to another device or browser
1. On the old device: **Export Raw**.
2. Move the file (cloud drive, email to yourself, USB…).
3. On the new device: open the site, then **Import Report** (Basic) or **Import raw / log file** (Advanced).

Colour presets move separately — see [Colours and text](colours-and-text.md#saving-your-own-presets).

## A good backup habit
- Export Raw after a long session, and before clearing browser data, reinstalling or switching devices.
- Keep a couple of dated copies (the file name already includes the date and time).
- After restoring, open the Advanced view's Storage section to confirm the match count.

## What clears your archive
Clearing your browser's "site data" or "cookies and site data" for this site; using a private/incognito window (it is discarded when closed); or **Delete entire archive**. **Clear** in the Basic view does *not* touch it.
