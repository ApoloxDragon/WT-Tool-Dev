# Reading your logs

The site analyzes the **text** that War Thunder gives you for each finished match. You do not have to clean it up — paste it as it is, several matches at a time if you like.

## What a match looks like
A match report contains, in order:

1. **A headline** — *Victory* or *Defeat* in the battle mode, naming the mission (for example *Victory in the [Mode] Mission name mission!*).
2. **The events of the match** — your scoring events (hits, kills, assists, awards, and so on) with the Silver Lions (SL) and Research Points (RP) each one earned.
3. **Rewards and costs** — flat rewards, and the repair, ammunition and respawn costs.
4. **Research** — which vehicle you were *researching* (a whole new vehicle unlocked) and which module or research progress received RP.
5. **Used items** — consumables such as boosters, when listed.
6. **The Session line** — a unique code identifying that match.
7. **The Total line** — net SL, CRP and RP for the match.

## Where the numbers come from

| Number | Meaning |
|---|---|
| **Net SL** | Silver Lions earned in the match after costs, taken from the Total line. |
| **RP (what the site counts)** | The match's **CRP** figure from the Total line. |
| **Research targets** | RP that went toward unlocking a **whole new vehicle** ("Researched unit"). |
| **Other RP** | RP that went to **modules or research progress** on a different vehicle ("Researching progress"). Kept apart so the two are never mixed. |
| **Win / loss** | From the headline, *Victory* or *Defeat*. |
| **Time played** | From the match's own time information, used for the goal calculator's time estimate. |

### Why CRP and not the last "RP" figure?
The Total line can end with a third figure labelled RP. That figure is CRP **plus** the research-progress RP added together — the same match performance counted toward two things at once, not an extra payout. Using it would inflate every average and the goal calculator's estimates. The site therefore uses **CRP** as a match's RP.

## Session IDs and duplicates
Every match has a unique **Session ID**. The site uses it to avoid counting a match twice:

- Pasting overlapping ranges of your history is fine — a match seen again is struck through and left out of every total.
- The archive keeps **one copy per Session ID**.
- A match with *no* readable Session ID cannot be recognised as a repeat, so each such paste counts separately. If you see this, paste each match once.

## What if text looks different?
Game text can change between War Thunder updates. If a paste is "not recognised", make sure it includes the headline (*Victory/Defeat in the …*) and the *Total* line. Lines that are not understood are skipped rather than breaking the analysis. See [Troubleshooting](troubleshooting.md).

## Battle types (categories)
Each match is placed in a **battle type** by looking at its mode name. By default anything containing *Tank Assault* is its own category, and everything else is *Random Battles*. You can add your own rules — see [The Basic view](basic-view.md#battle-type-categories).
