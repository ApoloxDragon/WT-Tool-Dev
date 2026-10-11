# Walkthrough: your first session, with real numbers

This page follows the **sample session** that ships with the site, so you can click along and compare. (The numbers below are what the sample produced when this page was written; if the sample file is ever updated, yours may differ slightly.)

## 1. Load the sample
Open the Basic view and click **Load Example Data**. The paste box fills with the sample and the page analyzes it.

You will see a warning: *17 duplicate match(es) detected by Session ID and excluded from totals.* The sample contains 84 match reports, but 17 are repeats of others — exactly what happens when you paste overlapping history. The site counts each match once: **67 matches**.

## 2. Overall
| Tile | Value | Meaning |
|---|---|---|
| Matches | 67 | Unique matches counted |
| Win rate | 62.7% | Wins divided by matches |
| Total net SL | 1,365,776 | All earnings after costs |
| Total RP | 304,022 | Sum of each match's CRP |

## 3. The split by battle type
| Battle type | Matches | W/L | Win% | Total net SL | Avg win SL | Avg loss SL | Total RP |
|---|---|---|---|---|---|---|---|
| Random Battles | 28 | 9/19 | 32.1% | 348,583 | 12,811 | 12,278 | 79,087 |
| Tank Assault | 39 | 33/6 | 84.6% | 1,017,193 | 30,293 | 2,923 | 224,935 |

What to notice:
- The two groups behave **very differently** (a 32% win rate versus 85%). Overall averages hide that, which is why the split exists.
- In Random Battles a win and a loss pay almost the same net SL here, while in Tank Assault a win pays about ten times a loss. That matters for the goal calculator.

## 4. RP by research target
The biggest targets in the sample:

| Target | RP earned |
|---|---|
| Radkampfwagen 90 | 138,703 |
| Begleitpanzer 57 | 71,852 |
| Leopard 2K | 70,652 |
| T-72M1(Germany) | 26,462 |

Note that these figures are a *different measure* from the 304,022 total above (they count RP credited to each research target, not each match's CRP), so don't expect them to add up to it. Open **Other RP** to see module and research progress lines (for example *Leopard 2K — Adjustment of Fire*, 11,994) — a **separate view** of the same earning, not extra RP. See [Key concepts](concepts.md#where-rp-goes-new-vehicle-vs-moduleprogress).

## 5. The goal calculator
The calculator starts from **All Combined**: win rate 62.7%, average win RP 5,769, average loss RP 2,468, average win SL 26,547, average loss SL 10,033.

Suppose you still need **60,000 RP** and **300,000 SL**:

| Result | Value |
|---|---|
| Expected RP per match | 4,538 |
| Expected net SL per match | 20,387 |
| Expected time per match | 14:26 |
| Matches needed — RP goal | 14 |
| Matches needed — SL goal | 15 |
| Headline | **15 matches · SL-bound** |
| Estimated playtime | 3.6 hours |

Turn on **+30% RP Booster** and expected RP rises to 5,899 per match; the RP goal drops to 11 matches. The headline stays at **15** because SL is the slower goal — the booster doesn't help SL. The full explanation, with the arithmetic, is in [The goal calculator in depth](goal-calculator-guide.md).

## 6. The per-match table
Scroll to **Per-match detail**. Struck-through rows are the 17 duplicates, with their SL/RP shown as — and the note *DUPLICATE — excluded*.

## 7. Open the Advanced view
Click **Advanced view →**. The sample's matches are now in your archive (the page said so under the buttons). Try:

1. Click a row marked **●** to open its breakdown — see [Reading a match's detail](match-detail-guide.md).
2. Filter to **Victories**, sort by **Most SL**.
3. Open **Insights → By map** — see [Insights explained](insights-guide.md).
4. Look at **Storage**: how many matches, how small the compressed archive is, and whether you have a backup.

## 8. Make a backup
In **Storage**, click **Export raw (.json.gz)**. That file is a complete, restorable copy of your archive's original match text. See [Backups, import and export](backups-import-export.md).

## 9. Make it yours
Click a swatch in the top bar, or **Customise…**, and try Daylight or Crimson. See [Colours and text](colours-and-text.md).

## Where next
- The same steps with your own logs: [Getting started](getting-started.md).
- Ideas for what to do with the data: [Recipes: how do I…?](recipes.md).
