# The goal calculator in depth

The goal calculator answers one question: **"At the rate I actually play, how many more matches until I reach this goal?"** It uses *your own* averages, so it gets more useful the more matches you have analyzed.

## The inputs
| Field | What it is | Where the starting value comes from |
|---|---|---|
| **Load averages from** | Which battle type's averages to use | A drop-down of your categories plus **All Combined** |
| **Win rate %** | Share of matches you win | The chosen category's win rate |
| **Avg win RP / Avg loss RP** | Average RP in a win / in a loss | The chosen category |
| **Avg win SL / Avg loss SL** | Average **net** SL in a win / in a loss | The chosen category |
| **RP goal remaining** | RP you still need | You type it |
| **SL goal remaining** | SL you still need | You type it |
| **+30% RP Booster** | Toggle: multiply expected RP by 1.3 | You choose |

Every field can be edited after loading. Changing one updates the answer immediately — that is how you ask "what if my win rate were 70%?".

## The arithmetic
Let *w* be the win rate as a fraction (62.7% → 0.627).

- **Expected RP per match** = (*w* × avg win RP + (1 − *w*) × avg loss RP), times 1.3 if the booster is on.
- **Expected net SL per match** = *w* × avg win SL + (1 − *w*) × avg loss SL.
- **Expected time per match** = *w* × average win time + (1 − *w*) × average loss time.
- **Matches needed — RP goal** = RP goal ÷ expected RP, **rounded up**.
- **Matches needed — SL goal** = SL goal ÷ expected net SL, **rounded up**.
- The headline **matches needed** is the **larger** of the two (you must satisfy both). It is labelled **RP-bound**, **SL-bound** or **tied**.
- **Estimated playtime** = matches needed × expected time per match.

### Worked example (the sample session, All Combined)
Win rate 62.7%, avg win RP 5,769, avg loss RP 2,468, avg win SL 26,547, avg loss SL 10,033.

- Expected RP = 0.627 × 5,769 + 0.373 × 2,468 ≈ **4,538**
- Expected net SL = 0.627 × 26,547 + 0.373 × 10,033 ≈ **20,387**
- Goals 60,000 RP and 300,000 SL: 60,000 ÷ 4,538 = 13.2 → **14**; 300,000 ÷ 20,387 = 14.7 → **15**
- Headline: **15 matches, SL-bound**; at 14:26 per match, about **3.6 hours**.

With the booster: expected RP = 4,538 × 1.3 ≈ **5,899** → 60,000 ÷ 5,899 = 10.2 → **11** RP matches. Headline still **15** (SL).

## Reading the result
- **Only one goal filled in?** Leave the other empty. The empty one is ignored and the label follows the one you set.
- **A dash (—)** means there isn't enough to compute (no goal entered, or the expected value is zero).
- **"Tied"** means both goals take the same number of matches.
- **Expected time** needs time data; if your matches have none, time shows as a dash.

## Choosing the right averages
- **Pick the battle type you will actually play.** In the sample, Random Battles and Tank Assault differ hugely; "All Combined" blends them and describes neither.
- **Very few matches in a category means shaky averages.** Three matches is an anecdote, not a rate. Edit the fields by hand if you know better.
- **The booster is only a toggle for RP.** It does not touch SL or time.
- **Vehicle-specific play.** If a vehicle earns very differently from the rest, analyze only logs from it (or filter in the Advanced view) and type the averages in by hand.

## Honest limits
- It is an **expectation**, not a promise: real streaks happen.
- It assumes future matches look like past ones — same mode, same vehicles, same habits.
- It does not know about game events, premium status changes, or reward changes between updates.
- Averages are of **net** SL (after costs), so an expensive-to-repair vehicle already lowers them.
- RP uses **CRP** per match ([why](reading-your-logs.md#why-crp-and-not-the-last-rp-figure)).

## Questions people ask
**Why does my RP goal say 14 but the headline says 15?** The headline is whichever goal takes longer; here SL does.

**Can I get "hours" for a goal in a particular mode?** Choose that mode in *Load averages from*; the time estimate uses that mode's average win and loss time.

**Is my goal saved?** Not between visits; the loaded averages follow your data and the goal fields start empty each time.
