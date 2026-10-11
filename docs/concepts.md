# Key concepts

This page explains the ideas behind the numbers, so every screen makes sense. It describes what the *site* does with your logs; for game rules themselves, the game is the authority.

## The match is the unit
Everything starts with **one match report** — the text War Thunder shows for a finished battle. The site reads it into a small record: result (win or loss), battle type, mission, net SL, RP, research targets, time played and a **Session ID**. All totals and averages are built by adding these records up.

## Two kinds of currency
- **SL (Silver Lions)** — money. The site shows **net SL**: what you earned minus what the match cost (repairs, ammunition and crew replenishment, respawns). A match can have a high *earned* SL and a much lower *net* SL.
- **RP (Research Points)** — what you spend to unlock vehicles and modules. The site counts a match's **CRP** as its RP (see [Reading your logs](reading-your-logs.md#why-crp-and-not-the-last-rp-figure)).

## Where RP goes: new vehicle vs module/progress
A match can earn RP toward more than one thing at once. The site keeps them apart:

| Bucket | Where you see it | Meaning |
|---|---|---|
| **Research target** | *RP by research target* | RP that went toward unlocking a **whole new vehicle** |
| **Other RP** (module / progress) | *Other RP* (collapsed) | RP that went toward **modules and research progress** on a vehicle |

They are **not added together**, because the same match performance is credited to both. Seeing a big "Other RP" number does not mean you earned extra — it is a different view of the same earning.

## Net SL vs earned SL
The Advanced view's match detail shows both. **Earned SL** is what the match paid out; **net SL** subtracts costs. The totals on the Basic view use **net SL**, because it reflects what you actually gained.

## Wins, losses and averages
A match is a **win** (Victory) or a **loss** (Defeat). The site averages SL and RP **separately for wins and for losses** because they are very different. Those four averages (plus your win rate) drive the [goal calculator](goal-calculator-guide.md): your expected income per match is the win rate times the average win plus the loss rate times the average loss.

## Battle types (categories)
Different modes pay very differently, so mixing them hides the truth. The site splits matches into **battle types** by looking at the mode name. You can define your own groups ([Battle-type categories](categories-guide.md)).

## Sessions, duplicates and the Session ID
Each match report carries a unique **Session ID**. It lets the site recognise a match it has already seen:

- while analyzing, repeats are struck through and left out of every total;
- in the archive, only one copy per Session ID is ever kept.

A "session" in this site's language is simply **what is in the paste box plus anything you imported** — not a game session.

## Current session vs archive
There are two places matches can live:

| | Current session | Archive |
|---|---|---|
| What it is | What is in the paste box, plus any imported summaries | Every match you have ever analyzed in this browser |
| Where it shows | The **Basic view** results | The **Advanced view** |
| Cleared by | **Clear** | Only **Delete entire archive**, deleting single matches, or clearing browser data |
| Survives closing the tab | Yes — the pasted text is remembered and analyzed again when you come back | Yes |

Analyzing adds the session's matches to the archive automatically. See [Where your data goes](data-lifecycle.md).

## Detail vs summary
- A match with **detail (●)** has its original text stored. The Advanced view can unpack it into vehicles, events, costs and research.
- A match with only a **summary (○)** was imported from a minimal export or HTML report. It still counts in totals, maps and win rates, but has no breakdown.

Raw exports keep the original text, so they are the only backup that preserves detail.

## Everything is local
Parsing, counting, compression, storage and colour handling all happen in your browser. There is no account and nothing is sent anywhere. See [Privacy and safety](privacy-and-safety.md).
