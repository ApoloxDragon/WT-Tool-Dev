# Reading a match's detail

In the Advanced view, clicking a **●** row opens that match's **breakdown**. This page explains every part of it. (A **○** row has no breakdown; see [Key concepts](concepts.md#detail-vs-summary).)

## The header
A coloured strip at the top gives: **result**, battle type, mode, the **mission** (map), **time played** and the **Session ID**.

## The five tiles
| Tile | Meaning |
|---|---|
| **Net SL** | Silver Lions after costs — what the totals use |
| **Earned SL** | What the match paid out before costs |
| **Repair / ammo / respawn** | The costs together |
| **RP (CRP)** | The match's RP as the site counts it |
| **Activity** | The match's activity percentage, as reported in the log |

A dash means the log did not contain that figure.

## Vehicles
One row per vehicle you used:

| Column | Meaning |
|---|---|
| **Vehicle** | Name. Tags: **damaged** and **backup** when the log flags them |
| **Time** | Time on that vehicle |
| **Activity** | Activity percentage for the vehicle |
| **Activity SL / Activity RP** | SL and RP credited for activity |
| **Play RP** | RP credited for time played |
| **Skill bonus RP** | RP from a skill bonus (the skill level is shown in brackets when present) |

Dashes mean the log has no figure for that vehicle and column.

## Events
Each kind of scoring event gets a **collapsible section** (for example, one per award type). The heading tells you how many events it holds and their total SL and RP. Open one to see a table; only columns that at least one event uses are shown:

**Time · Award · Vehicle · Weapon · Target · Note · Pts**, then **SL** and **RP**.

### The hover breakdown
**Hover an SL or RP amount** (it is a tooltip, so touch screens may not show it) to see how it is made: **base**, plus **premium account**, plus **booster** when those apply. This is the quickest way to see what a premium account or booster added to a single event.

## Flat rewards & costs
Rewards that are not tied to individual events (as listed in the log), then the three cost lines: **Automatic repair**, **Ammo & crew replenishment** and **Respawns in battle**.

## Research
A table of what the match's RP went toward: **New vehicle** targets and **Module / progress** items, each with RP. These are the same two buckets as on the Basic view ([Key concepts](concepts.md#where-rp-goes-new-vehicle-vs-moduleprogress)).

## Used items
Consumables and other items listed in the log, shown as plain text when present.

## "Lines weren't recognised"
If some lines could not be understood, a yellow note says how many. Nothing is lost: the lines are still in the raw text. This usually means the game wording changed; the rest of the breakdown is still valid.

## Raw log text
A collapsible block with the **original text**, always available for ● matches, so you can check any number against the source.

## Buttons
- **Copy raw text** — copies the original text to your clipboard. If your browser blocks clipboard access, select the text by hand.
- **Export this match (raw)** — saves just this match as a raw file (re-importable).
- **Delete from archive** — removes this match after a confirmation. It cannot be undone unless you have a raw export.

## Closing
**Close ✕** or **Esc**. Opening another row replaces the panel. While a match loads you briefly see *Loading…*; you never see the previous match's numbers under a new title.

## When the panel says it can't read the match
*"This match's stored text could not be read"* means the stored copy is damaged. Delete it and re-import it from a raw export or the original log.
